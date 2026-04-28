import json
import asyncio
from django.utils import timezone
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser


# ── helpers ───────────────────────────────────────────────────────────────────

def _user_info(user):
    return {
        'id':         user.id,
        'user_id':    user.id,   # matches ParticipantSerializer field name
        'username':   user.username,
        'first_name': user.first_name or user.username,
    }


# ── Lobby Consumer ────────────────────────────────────────────────────────────

class LobbyConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        if isinstance(self.scope['user'], AnonymousUser):
            await self.close(code=4001)
            return

        self.user      = self.scope['user']
        self.join_code = self.scope['url_route']['kwargs']['join_code']
        self.group     = f'lobby_{self.join_code}'

        tournament = await self._get_tournament()
        if not tournament:
            await self.close(code=4004)
            return
        if tournament.status == 'finished':
            await self.close(code=4003)
            return

        self.tournament_id = tournament.id
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

        # Send current lobby state to this new connection
        state = await self._lobby_state()
        await self.send(json.dumps({'type': 'lobby_state', **state}))

        # Broadcast "someone joined" — include sender_id so clients can skip their own event
        await self.channel_layer.group_send(self.group, {
            'type':      'lobby_participant_joined',
            'user':      _user_info(self.user),
            'sender_id': self.user.id,
            'count':     state['participant_count'],
            'max':       state['max_players'],
        })

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group, self.channel_name)
        await self.channel_layer.group_send(self.group, {
            'type':    'lobby_participant_left',
            'user_id': self.user.id,
        })

    async def receive(self, text_data):
        data = json.loads(text_data)
        msg_type = data.get('type')

        if msg_type == 'start_tournament':
            await self._handle_start()
        elif msg_type == 'update_text':
            await self._handle_update_text(data.get('text', ''))
        elif msg_type == 'ping':
            await self.send(json.dumps({'type': 'pong'}))

    # ── handlers ──────────────────────────────────────────────────────────────

    async def _handle_start(self):
        try:
            error, bracket_data = await self._start_tournament()
            if error:
                await self.send(json.dumps({'type': 'error', 'message': error}))
                return
            await self.channel_layer.group_send(self.group, {
                'type':    'lobby_tournament_started',
                'bracket': bracket_data,
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            await self.send(json.dumps({'type': 'error', 'message': f'Server error: {str(e)}'}))

    async def _handle_update_text(self, text):
        tournament = await self._get_tournament()
        if tournament.created_by_id != self.user.id:
            return
        if text.strip():
            await self._save_text(text.strip())
            await self.channel_layer.group_send(self.group, {
                'type': 'lobby_text_updated',
                'text': text.strip(),
            })

    # ── channel layer event handlers (snake_case → camelCase for JS) ──────────

    async def lobby_participant_joined(self, event):
        # Don't echo back to the user who just connected — they got lobby_state already
        if event.get('sender_id') == self.user.id:
            return
        await self.send(json.dumps({'type': 'participant_joined', **{k: v for k, v in event.items() if k not in ('type', 'sender_id')}}))

    async def lobby_participant_left(self, event):
        await self.send(json.dumps({'type': 'participant_left', 'user_id': event['user_id']}))

    async def lobby_tournament_started(self, event):
        await self.send(json.dumps({'type': 'tournament_started', 'bracket': event['bracket']}))

    async def lobby_text_updated(self, event):
        await self.send(json.dumps({'type': 'text_updated', 'text': event['text']}))

    # ── DB helpers ────────────────────────────────────────────────────────────

    @database_sync_to_async
    def _get_tournament(self):
        from .models import Tournament
        return Tournament.objects.filter(join_code=self.join_code).first()

    @database_sync_to_async
    def _lobby_state(self):
        from .models import Tournament
        t = Tournament.objects.get(join_code=self.join_code)
        participants = [
            _user_info(p.user)
            for p in t.participants.select_related('user').all()
        ]
        return {
            'tournament_id':    t.id,
            'name':             t.name,
            'join_code':        t.join_code,
            'status':           t.status,
            'time_limit':       t.time_limit,
            'max_players':      t.max_players,
            'participant_count':t.participants.count(),
            'participants':     participants,
            'text':             t.text,
            'is_teacher':       t.created_by_id == self.user.id,
            'is_participant':   t.participants.filter(user_id=self.user.id).exists(),
        }

    @database_sync_to_async
    def _start_tournament(self):
        import json as _json
        from .models import Tournament
        from .bracket import generate_bracket
        from .serializers import BracketSerializer

        tournament = Tournament.objects.filter(join_code=self.join_code).first()
        if not tournament:
            return ('Tournament not found.', None)
        if tournament.created_by_id != self.user.id:
            return ('Only the teacher can start.', None)
        if tournament.status != Tournament.WAITING:
            return ('Tournament already started.', None)
        count = tournament.participants.count()
        if count < 2:
            return (f'Need at least 2 participants (currently {count}).', None)

        tournament.status = Tournament.ACTIVE
        tournament.save()
        generate_bracket(tournament)
        tournament.refresh_from_db()
        return (None, _json.loads(_json.dumps(BracketSerializer(tournament).data)))

    @database_sync_to_async
    def _save_text(self, text):
        from .models import Tournament
        Tournament.objects.filter(join_code=self.join_code).update(text=text)


# ── Match Consumer ────────────────────────────────────────────────────────────

# In-memory state — fine for a single Fly.io machine
_match_players:   dict[int, set]  = {}  # match_id → {user_id, ...}
_match_status:    dict[int, str]  = {}  # match_id → 'pending'|'active'|'finished'
_match_results:   dict[int, dict] = {}  # match_id → {user_id: {wpm, accuracy, progress}}
_disconnect_tasks: dict[str, asyncio.Task] = {}
# Strong references so asyncio doesn't garbage-collect background tasks mid-execution
_bg_tasks: set = set()


def _fire(coro):
    """Schedule a coroutine as a fire-and-forget task, keeping a strong reference."""
    task = asyncio.ensure_future(coro)
    _bg_tasks.add(task)
    task.add_done_callback(_bg_tasks.discard)
    return task


class MatchConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        if isinstance(self.scope['user'], AnonymousUser):
            await self.close(code=4001)
            return

        self.user     = self.scope['user']
        self.match_id = int(self.scope['url_route']['kwargs']['match_id'])
        self.group    = f'match_{self.match_id}'

        match = await self._get_match()
        if not match:
            await self.close(code=4004)
            return

        self.is_spectator = await self._is_spectator(match)

        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

        # Cancel any pending disconnect timeout for this user (reconnect)
        task_key = f'{self.match_id}_{self.user.id}'
        if task_key in _disconnect_tasks:
            _disconnect_tasks.pop(task_key).cancel()

        # Send current state to the connecting client
        state = await self._match_state(match)
        await self.send(json.dumps({'type': 'match_state', **state}))

        # Already finished (e.g. auto-BYE) — tell the client immediately
        if match.status == 'finished':
            summary = await self._build_summary(match)
            await self.send(json.dumps({
                'type':    'match_finished',
                'winner':  _user_info(match.winner.user) if match.winner else None,
                'reason':  'bye',
                'results': {},
                'summary': summary,
            }))
            return

        # Register player and check if both are now connected
        if not self.is_spectator:
            _match_players.setdefault(self.match_id, set()).add(self.user.id)
            players_now   = len(_match_players[self.match_id])
            cached_status = _match_status.get(self.match_id, 'pending')

            if cached_status == 'pending' and players_now >= 2:
                _match_status[self.match_id] = 'active'
                await self._activate_match()
                await self.channel_layer.group_send(self.group, {'type': 'match_activated'})
                _fire(self._run_countdown())
            elif cached_status == 'active' or match.status == 'active':
                # Reconnect or server-restart recovery — re-sync in-memory and re-signal
                _match_status[self.match_id] = 'active'
                await self.channel_layer.group_send(self.group, {'type': 'match_activated'})

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group, self.channel_name)
        _match_players.setdefault(self.match_id, set()).discard(self.user.id)

        if not self.is_spectator:
            task_key = f'{self.match_id}_{self.user.id}'
            task = _fire(self._disconnect_timeout(task_key))
            _disconnect_tasks[task_key] = task

            await self.channel_layer.group_send(self.group, {
                'type':    'match_opponent_disconnected',
                'user_id': self.user.id,
            })

    async def receive(self, text_data):
        data = json.loads(text_data)
        msg  = data.get('type')

        if msg == 'typing_update':
            await self._handle_typing(data)
        elif msg == 'ping':
            await self.send(json.dumps({'type': 'pong'}))

    # ── handlers ──────────────────────────────────────────────────────────────

    async def _handle_typing(self, data):
        cached = _match_status.get(self.match_id)
        if cached == 'finished':
            return
        if cached != 'active':
            # Recover in-memory status from DB (e.g. after server restart)
            match = await self._get_match()
            if not match or match.status != 'active':
                return
            _match_status[self.match_id] = 'active'

        wpm      = float(data.get('wpm', 0))
        accuracy = float(data.get('accuracy', 100))
        progress = float(data.get('progress', 0))

        _match_results.setdefault(self.match_id, {})[self.user.id] = {
            'wpm': wpm, 'accuracy': accuracy, 'progress': progress
        }

        # Broadcast to everyone (including sender — frontend filters by user_id)
        await self.channel_layer.group_send(self.group, {
            'type':     'match_progress',
            'user_id':  self.user.id,
            'wpm':      wpm,
            'accuracy': accuracy,
            'progress': progress,
        })

        if progress >= 100:
            await self._finish_match(winner_id=self.user.id, reason='finished')

    async def _run_countdown(self):
        for i in [3, 2, 1]:
            await self.channel_layer.group_send(self.group, {'type': 'match_countdown', 'count': i})
            await asyncio.sleep(1)
        await self.channel_layer.group_send(self.group, {'type': 'match_countdown', 'count': 0})

        if _match_status.get(self.match_id) != 'active':
            return
        match = await self._get_match()
        if not match:
            return
        time_limit = match.round.tournament.time_limit
        print(f'[MATCH {self.match_id}] timer started: {time_limit}s', flush=True)
        await asyncio.sleep(time_limit)
        print(f'[MATCH {self.match_id}] timer expired, status={_match_status.get(self.match_id)}', flush=True)
        if _match_status.get(self.match_id) == 'active':
            await self._finish_match(winner_id=None, reason='timeout')

    async def _disconnect_timeout(self, task_key):
        await asyncio.sleep(10)
        _disconnect_tasks.pop(task_key, None)
        if _match_status.get(self.match_id) == 'active':
            await self._finish_match(winner_id=None, reason='disconnect',
                                     disconnected_id=self.user.id)

    async def _finish_match(self, winner_id, reason, disconnected_id=None):
        print(f'[MATCH {self.match_id}] _finish_match called, reason={reason}, status={_match_status.get(self.match_id)}', flush=True)
        if _match_status.get(self.match_id) == 'finished':
            print(f'[MATCH {self.match_id}] already finished, skipping', flush=True)
            return
        _match_status[self.match_id] = 'finished'

        match = await self._get_match()
        if not match:
            print(f'[MATCH {self.match_id}] match not found in DB — broadcasting anyway', flush=True)
        elif match.status == 'finished':
            print(f'[MATCH {self.match_id}] match already finished in DB — broadcasting anyway', flush=True)

        results = _match_results.get(self.match_id, {})
        winner  = None
        summary = {}

        if match and match.status != 'finished':
            try:
                winner  = await self._determine_winner(match, winner_id, results, reason, disconnected_id)
                summary = await self._save_match_result(match, winner, results)
            except Exception:
                import traceback
                traceback.print_exc()
            finally:
                _match_results.pop(self.match_id, None)
                _match_players.pop(self.match_id, None)

        print(f'[MATCH {self.match_id}] broadcasting match_finished, winner_id={winner.user_id if winner else None}', flush=True)
        # msgpack requires string keys — convert user_id ints to strings
        safe_results = {str(k): v for k, v in results.items()}
        # Always broadcast — even if DB save failed the players must see results
        await self.channel_layer.group_send(self.group, {
            'type':    'match_finished',
            'winner':  _user_info(winner.user) if winner else None,
            'reason':  reason,
            'results': safe_results,
            'summary': summary,
        })

    # ── channel layer event handlers ──────────────────────────────────────────

    async def match_state(self, event):
        await self.send(json.dumps({'type': 'match_state', **{k: v for k, v in event.items() if k != 'type'}}))

    async def match_countdown(self, event):
        await self.send(json.dumps({'type': 'countdown', 'count': event['count']}))

    async def match_progress(self, event):
        await self.send(json.dumps({
            'type':     'opponent_progress',
            'user_id':  event['user_id'],
            'wpm':      event['wpm'],
            'accuracy': event['accuracy'],
            'progress': event['progress'],
        }))

    async def match_finished(self, event):
        await self.send(json.dumps({
            'type':    'match_finished',
            'winner':  event['winner'],
            'reason':  event['reason'],
            'results': event['results'],
            'summary': event.get('summary'),
        }))

    async def match_activated(self, event):
        await self.send(json.dumps({'type': 'match_activated'}))

    async def match_opponent_disconnected(self, event):
        if event['user_id'] != self.user.id:
            await self.send(json.dumps({'type': 'opponent_disconnected', 'user_id': event['user_id']}))

    # ── DB helpers ────────────────────────────────────────────────────────────

    @database_sync_to_async
    def _build_summary(self, match):
        from .models import Match
        from .bracket import advance_winner
        tournament = match.round.tournament
        next_match = Match.objects.filter(
            round__tournament=tournament,
            round__round_number=match.round.round_number + 1,
            match_number=(match.match_number + 1) // 2,
        ).first()
        return {
            'next_match_id':       next_match.id if next_match and next_match.status != 'finished' else None,
            'tournament_finished': tournament.status == 'finished',
        }

    @database_sync_to_async
    def _get_match(self):
        from .models import Match
        return Match.objects.select_related(
            'round__tournament',
            'player1__user', 'player2__user', 'winner__user',
        ).filter(pk=self.match_id).first()

    @database_sync_to_async
    def _is_spectator(self, match):
        p1_id = match.player1.user_id if match.player1 else None
        p2_id = match.player2.user_id if match.player2 else None
        return self.user.id not in (p1_id, p2_id)

    @database_sync_to_async
    def _activate_match(self):
        from .models import Match
        Match.objects.filter(pk=self.match_id, status=Match.PENDING).update(
            status=Match.ACTIVE, started_at=timezone.now()
        )

    @database_sync_to_async
    def _match_state(self, match):
        t = match.round.tournament
        return {
            'match_id':   match.id,
            'status':     match.status,
            'text':       t.text,
            'time_limit': t.time_limit,
            'join_code':  t.join_code,
            'round_name': match.round.round_name,
            'player1':    _user_info(match.player1.user) if match.player1 else None,
            'player2':    _user_info(match.player2.user) if match.player2 else None,
            'is_spectator': self.is_spectator,
        }

    @database_sync_to_async
    def _determine_winner(self, match, winner_id, results, reason, disconnected_id):
        p1 = match.player1
        p2 = match.player2

        if reason == 'disconnect' and disconnected_id:
            # Opponent of disconnected player wins
            if p1 and p1.user_id == disconnected_id:
                return p2
            return p1

        if winner_id:
            if p1 and p1.user_id == winner_id:
                return p1
            return p2

        # Timeout — compare WPM then accuracy
        r1 = results.get(p1.user_id if p1 else 0, {'wpm': 0, 'accuracy': 0})
        r2 = results.get(p2.user_id if p2 else 0, {'wpm': 0, 'accuracy': 0})
        if r1['wpm'] > r2['wpm']:
            return p1
        if r2['wpm'] > r1['wpm']:
            return p2
        return p1 if r1['accuracy'] >= r2['accuracy'] else p2

    @database_sync_to_async
    def _save_match_result(self, match, winner, results):
        from .models import Match, Participant
        from .bracket import advance_winner, check_round_complete, activate_next_round

        p1 = match.player1
        p2 = match.player2

        r1 = results.get(p1.user_id if p1 else 0, {})
        r2 = results.get(p2.user_id if p2 else 0, {})

        match.winner     = winner
        match.status     = Match.FINISHED
        match.finished_at= timezone.now()
        match.p1_wpm      = r1.get('wpm')
        match.p1_accuracy = r1.get('accuracy')
        match.p2_wpm      = r2.get('wpm')
        match.p2_accuracy = r2.get('accuracy')
        match.save()

        # Update participant stats
        for participant, res in [(p1, r1), (p2, r2)]:
            if participant and res:
                updated = False
                if res.get('wpm', 0) > participant.best_wpm:
                    participant.best_wpm = res['wpm']
                    updated = True
                if res.get('accuracy', 0) > participant.best_accuracy:
                    participant.best_accuracy = res['accuracy']
                    updated = True
                if updated:
                    participant.save()

        # Eliminate loser and assign their final position
        loser = p2 if winner == p1 else p1
        if loser:
            # Position = count of still-active players at moment of elimination
            remaining = Participant.objects.filter(
                tournament=match.round.tournament,
                is_eliminated=False,
            ).count()
            loser.is_eliminated   = True
            loser.final_position  = remaining   # 8 → 7 → 6 → … → 2
            loser.save()

        # Advance winner in bracket
        next_match = advance_winner(match)

        # Check if this round is done → activate next
        if check_round_complete(match.round):
            match.round.status = 'finished'
            match.round.save()
            tournament = match.round.tournament

            next_round = activate_next_round(tournament)

            # Tournament finished — crown the winner
            if not next_round:
                tournament.status = 'finished'
                tournament.save()
                if winner:
                    winner.final_position = 1
                    winner.save()

        return {
            'next_match_id': next_match.id if next_match else None,
            'tournament_finished': match.round.tournament.status == 'finished',
        }
