from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
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


class RewardDetailView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def patch(self, request, pk):
        if request.user.role != 'admin':
            return Response({'detail': 'Only an admin can edit rewards.'}, status=403)
        reward = get_object_or_404(Reward, pk=pk)
        serializer = RewardSerializer(reward, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        if request.user.role != 'admin':
            return Response({'detail': 'Only an admin can delete rewards.'}, status=403)
        reward = get_object_or_404(Reward, pk=pk)
        reward.delete()
        return Response(status=204)
