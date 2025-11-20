import pyotp
import qrcode
from io import BytesIO
import base64
from app.core.config import settings

def generate_secret(email: str) -> str:
    """生成Google Authenticator密钥"""
    return pyotp.random_base32()

def generate_qr_code(secret: str, email: str) -> str:
    """生成QR码（Base64）"""
    totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=email,
        issuer_name=settings.GOOGLE_AUTH_ISSUER
    )
    
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(totp_uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{img_str}"

def verify_token(secret: str, token: str) -> bool:
    """验证Google Authenticator验证码"""
    totp = pyotp.TOTP(secret)
    return totp.verify(token, valid_window=2)

