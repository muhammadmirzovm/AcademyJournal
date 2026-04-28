from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/', include('groups.urls')),
    path('api/', include('quiz.urls')),
    path('api/', include('tournament.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
