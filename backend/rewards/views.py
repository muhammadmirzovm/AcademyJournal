from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Reward
from .serializers import RewardSerializer


class RewardListCreateView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        rewards = Reward.objects.exclude(status=Reward.Status.HIDDEN)
        return Response(RewardSerializer(rewards, many=True).data)

    def post(self, request):
        if request.user.role != 'admin':
            return Response({'detail': 'Only an admin can add rewards.'}, status=403)
        serializer = RewardSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)
