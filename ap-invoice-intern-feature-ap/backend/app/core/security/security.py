from fastapi.security import OAuth2PasswordBearer

# Reuse standard OAuth2PasswordBearer to extract Authorization Header
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login",
    auto_error=False
)
