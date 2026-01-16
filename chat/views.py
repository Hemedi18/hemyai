from django.shortcuts import render, redirect
from django.http import JsonResponse, Http404
from django.conf import settings
from django.contrib.auth.decorators import login_required
from .models import ChatSession, ChatMessage
import google.generativeai as genai
import json


# This view renders the chat page
@login_required
def chat_view(request):
    # Fetch all chat sessions for the logged-in user
    chat_sessions = ChatSession.objects.filter(user=request.user).order_by('-created_at')
    
    active_session_id = request.GET.get('session_id')
    messages = []
    active_session = None

    if active_session_id:
        try:
            # Load messages from the selected session
            active_session = ChatSession.objects.get(id=active_session_id, user=request.user)
            messages = active_session.messages.all().order_by('timestamp') # Ensure messages are ordered correctly
        except ChatSession.DoesNotExist:
            return redirect('chat') # Redirect if session is invalid

    context = {
        'chat_sessions': chat_sessions,
        'messages': messages,
        'active_session': active_session,
    }
    return render(request, 'chat/chat.html', context)

# This view handles the AJAX request from the frontend
@login_required
def get_ai_response(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user_message_content = data.get('message')
            session_id = data.get('session_id')

            if not user_message_content:
                return JsonResponse({'error': 'Empty message received.'}, status=400)

            # Find existing session or create a new one
            if session_id:
                session = ChatSession.objects.get(id=session_id, user=request.user)
            else:
                # Create a new session for the first message
                session = ChatSession.objects.create(user=request.user, title=user_message_content[:50])

            # Save user message
            user_message = ChatMessage.objects.create(session=session, content=user_message_content, is_from_user=True)

            # Get AI response
            try:
                genai.configure(api_key=str(settings.GEMINI_API_KEY))
                # CORRECTED: Using a valid and available model name.
                model = genai.GenerativeModel("gemini-2.5-flash") 
                
                # Build chat history for context
                history = []
                previous_messages = session.messages.exclude(id=user_message.id).order_by('timestamp')
                for msg in previous_messages:
                    role = "user" if msg.is_from_user else "model"
                    history.append({"role": role, "parts": [msg.content]})
                
                chat = model.start_chat(history=history)
                response = chat.send_message(user_message_content)
                ai_response_content = response.text
            except Exception as e:
                # If the AI service fails, return a user-friendly error message.
                ai_response_content = f"Sorry, I couldn't process your request at the moment. Error: {str(e)}"

            ChatMessage.objects.create(session=session, content=ai_response_content, is_from_user=False)

            return JsonResponse({
                'message': ai_response_content,
                'session_id': session.id  # Return the session ID
            })

        except ChatSession.DoesNotExist:
            return JsonResponse({'error': 'Chat session not found.'}, status=404)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON in request.'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    return JsonResponse({'message': 'Invalid request'}, status=400)