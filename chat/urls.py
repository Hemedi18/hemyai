# chat/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.chat_view, name='chat'),
    path('get-ai-response/', views.get_ai_response, name='get-ai-response'),
]