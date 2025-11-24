from django import forms
from django.contrib.auth.models import User # Or your custom User model
from django.contrib.auth.forms import UserCreationForm

class UserRegisterForm(UserCreationForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        username_field = self.fields['username']
        is_required = username_field.required
        username_field.validators = []
        
        if is_required:
            username_field.required = True
        username_field.max_length = 255 
        