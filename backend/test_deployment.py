"""Exercise production orchestration without Docker, networks or real data."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

import pytest


ROOT = Path(__file__).resolve().parent.parent
REVISION = 'a' * 40


@pytest.fixture
def deployment(tmp_path):
    repo = tmp_path / 'repo'
    shutil.copytree(ROOT / 'deploy', repo / 'deploy')
    (repo / '.env').write_text('SECRET_KEY=fake-test-value\n')
    commands = tmp_path / 'bin'
    commands.mkdir()
    mock = commands / 'mock'
    mock.write_text(f'#!{sys.executable}\n' + r'''
import io, json, os, pathlib, sys, tarfile, hashlib
name = pathlib.Path(sys.argv[0]).name
args = sys.argv[1:]
command = ' '.join([name] + args)
with open(os.environ['COMMAND_LOG'], 'a') as log:
    log.write(json.dumps([name] + args) + '\n')
if os.environ.get('FAIL_COMMAND') and os.environ['FAIL_COMMAND'] in command:
    sys.exit(1)
if name == 'git' and args == ['rev-parse', 'HEAD']:
    print('b' * 40)
elif name == 'docker':
    if args[:3] == ['compose', 'ps', '--status']:
        if os.environ.get('WRITERS_RUNNING'): print('still-running')
    elif args[:3] == ['compose', 'ps', '-q']:
        print(args[3] + '-container')
    elif args[:2] == ['inspect', '-f']:
        print('healthy' if 'Health' in args[2] else 'running 0')
    elif 'pg_dump' in command:
        sys.stdout.buffer.write(b'fake-custom-format-backup')
    elif 'pg_restore' in args:
        sys.stdin.buffer.read()
        print('fake archive listing')
    elif '--entrypoint' in args and args[args.index('--entrypoint') + 1] == 'tar':
        with tarfile.open(fileobj=sys.stdout.buffer, mode='w|gz') as archive:
            data = b'fake uploaded file'
            entry = tarfile.TarInfo('example.txt')
            entry.size = len(data)
            archive.addfile(entry, io.BytesIO(data))
elif name == 'sha256sum':
    if args[0] == '--check':
        for line in pathlib.Path(args[1]).read_text().splitlines():
            digest, filename = line.split('  ')
            if digest != hashlib.sha256(pathlib.Path(filename).read_bytes()).hexdigest(): sys.exit(1)
    else:
        for filename in args:
            print(hashlib.sha256(pathlib.Path(filename).read_bytes()).hexdigest() + '  ' + filename)
''')
    mock.chmod(0o755)
    for command in ('docker', 'git', 'sleep', 'flock', 'sha256sum'):
        (commands / command).symlink_to(mock)
    log = tmp_path / 'commands.jsonl'
    env = {**os.environ, 'PATH': f'{commands}:{os.environ["PATH"]}', 'COMMAND_LOG': str(log)}
    env.pop('BACKUP_DIR', None)
    env.pop('FAIL_COMMAND', None)
    env.pop('WRITERS_RUNNING', None)

    def run(script='deploy.sh', revision=REVISION, **extra):
        result = subprocess.run(
            ['bash', str(repo / 'deploy' / script), *([revision] if script == 'deploy.sh' else [])],
            cwd=repo, env={**env, **extra}, capture_output=True, text=True,
        )
        calls = [' '.join(json.loads(line)) for line in log.read_text().splitlines()] if log.exists() else []
        return result, calls, repo
    return run


def test_deploy_backs_up_before_migration_and_opens_traffic_after_audit(deployment):
    result, calls, repo = deployment()
    assert result.returncode == 0, result.stderr
    index = lambda text: next(i for i, call in enumerate(calls) if text in call)
    assert index('manage.py check --deploy') < index('compose stop')
    assert index('compose stop') < index('pg_dump') < index('manage.py migrate')
    assert index('manage.py migrate') < index('audit_tenant_data --strict') < index('up -d --no-build backend')
    assert index('up -d --no-build backend') < index('up -d --no-build --force-recreate scheduler web')
    archives = list((repo / 'backups').iterdir())
    assert len(archives) == 1 and not archives[0].name.endswith('.partial')
    assert (archives[0] / 'revision.txt').read_text().strip() == 'b' * 40
    assert (archives[0] / 'environment.env').stat().st_mode & 0o077 == 0
    for line in (archives[0] / 'SHA256SUMS').read_text().splitlines():
        digest, filename = line.split('  ')
        assert digest == hashlib.sha256((archives[0] / filename).read_bytes()).hexdigest()


@pytest.mark.parametrize(('failure', 'forbidden'), [
    ('manage.py check --deploy', 'compose stop'),
    ('pg_dump', 'manage.py migrate'),
    ('pg_restore --list', 'manage.py migrate'),
    ('pg_restore --exit-on-error', 'manage.py migrate'),
    ('audit_tenant_data --strict', 'up -d'),
    ('compose exec -T web wget', 'Deploy complete'),
])
def test_deploy_stops_on_failed_safety_gate(deployment, failure, forbidden):
    result, calls, _ = deployment(FAIL_COMMAND=failure)
    assert result.returncode != 0
    assert forbidden not in '\n'.join(calls) + result.stdout


def test_backup_refuses_running_application_writers(deployment):
    result, calls, _ = deployment(script='backup.sh', WRITERS_RUNNING='true')
    assert result.returncode != 0
    assert not any('pg_dump' in call for call in calls)


def test_deploy_requires_exact_revision_before_docker_operations(deployment):
    result, calls, _ = deployment(revision='main')
    assert result.returncode != 0
    assert not any(call.startswith('docker ') for call in calls)
