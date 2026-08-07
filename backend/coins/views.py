from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CoinTransaction


class MyBalanceView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response({'balance': CoinTransaction.balance_for(request.user)})
