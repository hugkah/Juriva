from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from backend.database import get_db
from backend import models, schemas, auth
from backend.utils.email_utils import send_reset_password_email

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=schemas.UserOut)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(
        email=user.email, 
        password_hash=hashed_password,
        display_name=user.display_name,
        country=user.country
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

import secrets
from datetime import datetime, timedelta, timezone

@router.post("/forgot-password")
async def forgot_password(request: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user:
        # Pour des raisons de sécurité, on renvoie le même message même si l'utilisateur n'existe pas
        return {"message": "Si l'adresse e-mail existe, un lien de réinitialisation a été envoyé."}
    
    # Génération d'un token sécurisé
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    # Expiration dans 1 heure
    user.reset_token_expiry = datetime.now(timezone.utc) + timedelta(hours=1)
    db.commit()

    reset_link = f"http://localhost:5173/?reset_token={token}&email={user.email}"
    
    try:
        await send_reset_password_email(user.email, reset_link)
        return {"message": "Un lien de réinitialisation a été envoyé à votre adresse e-mail."}
    except Exception as e:
        print(f"Erreur lors de l'envoi de l'email : {e}")
        # En développement, on affiche quand même le lien dans la console
        print(f"Lien de secours (console) : {reset_link}")
        return {"message": "Erreur lors de l'envoi de l'email, mais vous pouvez trouver le lien dans la console du serveur."}

@router.post("/reset-password")
def reset_password(reset_data: schemas.PasswordReset, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.email == reset_data.email,
        models.User.reset_token == reset_data.token
    ).first()
    
    if not user:
        raise HTTPException(status_code=400, detail="Lien de réinitialisation invalide.")
    
    # Vérifier si le token a expiré
    # S'assurer que reset_token_expiry est conscient du fuseau horaire s'il est stocké sans
    expiry = user.reset_token_expiry
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)

    if datetime.now(timezone.utc) > expiry:
        raise HTTPException(status_code=400, detail="Le lien de réinitialisation a expiré.")
    
    # Mettre à jour le mot de passe et effacer le token
    user.password_hash = auth.get_password_hash(reset_data.new_password)
    user.reset_token = None
    user.reset_token_expiry = None
    db.commit()
    
    return {"message": "Mot de passe réinitialisé avec succès."}

@router.put("/update", response_model=schemas.UserOut)
def update_profile(user_update: schemas.UserUpdate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if user_update.display_name is not None:
        current_user.display_name = user_update.display_name
    if user_update.country is not None:
        current_user.country = user_update.country
    if user_update.custom_instructions is not None:
        current_user.custom_instructions = user_update.custom_instructions
    if user_update.password is not None:
        current_user.password_hash = auth.get_password_hash(user_update.password)
    
    db.commit()
    db.refresh(current_user)
    return current_user

@router.delete("/delete")
def delete_account(user_delete: schemas.UserDelete, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    # Vérifier le mot de passe
    if not auth.verify_password(user_delete.password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mot de passe incorrect",
        )
    
    # Supprimer l'utilisateur
    db.delete(current_user)
    db.commit()
    return {"message": "Compte supprimé avec succès"}
