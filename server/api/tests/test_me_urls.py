from django.test import TestCase
import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from api.views import (
    CheckSessionView,
    GetUserView,
    LogoutView,
    RefreshTokenView,
    UpdateUserView,
    AvatarUpdateView,
    DeleteAccountView,
)



class MeUrlsTest(TestCase):
    client = APIClient()
    def test_url_check_session(self):
        url = reverse("me-check-session")
        response = self.client.get(url)
        assert response.status_code in (200, 401)


    def test_url_get_user(self):
        url = reverse("me-get-user")
        response = self.client.get(url)
        assert response.status_code in (200, 401)


    def test_url_logout(self):
        url = reverse("logout-user")
        response = self.client.post(url)
        assert response.status_code in (200, 401)


    def test_url_refresh(self):
        url = reverse("token-refresh")
        response = self.client.post(url, {"refresh": "token-invalido"})
        assert response.status_code in (200, 400, 401)


    def test_url_update_user(self):
        url = reverse("update-user")
        response = self.client.patch(url, {"name": "novo"})
        assert response.status_code in (200, 400, 401)


    def test_url_update_avatar(self):
        url = reverse("update-avatar")
        response = self.client.post(url, {})
        assert response.status_code in (200, 400, 401)


    def test_url_delete_account(self):
        url = reverse("delete-account")
        response = self.client.delete(url)
        assert response.status_code in (200, 400, 401)