import os
import shutil
import base64
import fitz  # PyMuPDF
import docx
import re
import html
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form

# Charger les variables d'environnement depuis .env
load_dotenv()
from sqlalchemy.orm import Session
from typing import List, Optional
from groq import Groq
from datetime import datetime
from backend.database import get_db
from backend import models, schemas, auth

router = APIRouter(prefix="/chat", tags=["chat"])

# Récupération de la clé avec une erreur explicite si absente
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY or GROQ_API_KEY == "VOTRE_CLE_API_ICI":
    print("ATTENTION : La variable d'environnement GROQ_API_KEY n'est pas définie !")

client = Groq(api_key=GROQ_API_KEY if GROQ_API_KEY else "dummy_key")

UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

def extract_text_from_pdf(pdf_path):
    text = ""
    with fitz.open(pdf_path) as doc:
        for page in doc:
            text += page.get_text()
    return text

def extract_text_from_docx(docx_path):
    doc = docx.Document(docx_path)
    return "\n".join([para.text for para in doc.paragraphs])

def markdown_to_pdf_html(text):
    """Convertit le Markdown simple en tags compatibles avec ReportLab Paragraph."""
    if not text:
        return ""
    # 1. Échapper les caractères XML spéciaux (&, <, >)
    text = html.escape(text)
    
    # 2. Rétablir les balises autorisées après échappement (on remplace les tags MD par des tags HTML fermés)
    # Gras : **texte** -> <b>texte</b>
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    
    # Italique : *texte* ou _texte_ -> <i>texte</i>
    text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
    text = re.sub(r'_(.*?)_', r'<i>\1</i>', text)
    
    # Retours à la ligne : \n -> <br/>
    text = text.replace('\n', '<br/>')
    
    # Listes : "- " ou "* " en début de ligne -> "• "
    text = re.sub(r'^[-\*]\s', r'• ', text, flags=re.MULTILINE)
    
    return text

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def call_groq_ai(question: str, history: List[models.Message], user: models.User, file_path: Optional[str] = None, category: str = "Droit Général") -> str:
    try:
        # ... (rest of the detection logic)
        extracted_text = ""
        is_image = False
        
        if file_path:
            ext = file_path.split('.')[-1].lower()
            if ext in ['jpg', 'jpeg', 'png', 'webp']:
                is_image = True
            elif ext == 'pdf':
                extracted_text = extract_text_from_pdf(file_path)
            elif ext in ['doc', 'docx']:
                extracted_text = extract_text_from_docx(file_path)

        # Sélection du modèle
        model = "meta-llama/llama-4-scout-17b-16e-instruct" if is_image else "llama-3.3-70b-versatile"
        
        user_country = user.country if user else "France"
        custom_instr = user.custom_instructions if user and user.custom_instructions else ""
        
        is_guest = user is None
        
        if is_guest:
            # Mode Visiteur : Langue flexible (celle de la question)
            system_content = (
                "Tu es JURIVA, une IA experte en droit. Ton objectif est de fournir une assistance juridique rigoureuse et structurée."
                "\n\nDIRECTIVES DE RÉPONSE STRICTES :"
                "- **CITATION INTÉGRALE** : Pour chaque article de loi mentionné, écris le texte de l'article MOT POUR MOT."
                "- **EXPLICATION DÉTAILLÉE** : Explique le sens et la portée de chaque article cité."
                "- **EXEMPLES CONCRETS** : Fournis systématiquement un ou plusieurs exemples pratiques pour illustrer l'application de l'article."
                "- **SOURCES PRÉCISES** : Donne toujours les sources (Code, Loi, Décret, site officiel)."
                "- Sois directe et évite les introductions inutiles."
                "- Réponds TOUJOURS dans la langue de la question (Français ou Anglais)."
                "\n\nAPPEL À L'ACTION :"
                "- Termine par : 'Pour une analyse précise selon votre juridiction (Bénin, France, Nigeria, etc.), veuillez **créer un compte gratuit**.' "
                "- Rappelle que tes réponses ne remplacent pas un avocat."
            )
        else:
            # Mode Utilisateur Connecté : Langue fixée par le pays sélectionné
            english_countries = ["Nigeria", "Ghana", "Kenya", "South Africa", "USA", "UK", "Canada (English)", "Australia", "India", "Liberia", "Sierra Leone"]
            lang = "English" if user_country in english_countries else "French"

            if lang == "English":
                system_content = (
                    f"You are JURIVA, a high-level expert legal assistant for **{user_country}**. "
                    "\n\nSTRICT RESPONSE DIRECTIVES:"
                    "- **WORD-FOR-WORD CITATION**: For every legal article mentioned, you MUST write the text of the article WORD-FOR-WORD."
                    "- **DETAILED EXPLANATION**: Explain the meaning and legal implications of each article cited."
                    "- **REAL-LIFE EXAMPLES**: Provide concrete 'Real-life Examples' for every article to ensure clarity."
                    "- **OFFICIAL SOURCES**: Systematically provide links to official government websites or legal databases (e.g., official gazettes)."
                    "- Be direct, surgical, and professional."
                    f"- Your expertise is strictly limited to the laws of {user_country}."
                    "\n\nLEGAL DISCLAIMER:"
                    "Always remind the user at the end that this is information, not a formal legal consultation."
                )
            else:
                system_content = (
                    f"Tu es JURIVA, assistante juridique experte de haut niveau pour la juridiction : **{user_country}**. "
                    "\n\nDIRECTIVES DE RÉPONSE STRICTES :"
                    "- **CITATION MOT POUR MOT** : Pour chaque article de loi mentionné, tu DOIS écrire le texte intégral de l'article MOT POUR MOT."
                    "- **EXPLICATION DÉTAILLÉE** : Explique précisément le sens, l'esprit et l'application de chaque article cité."
                    "- **EXEMPLES CONCRETS** : Fournis systématiquement des exemples pratiques ('Exemple Concret') pour chaque article."
                    "- **SOURCES OFFICIELLES** : Donne les sources précises et, si possible, des liens vers les sites gouvernementaux (ex: Legifrance, Journaux Officiels)."
                    "- Sois directe, chirurgicale et utilise un Markdown riche (**gras**, `###`)."
                    f"- Ton analyse doit être exclusivement basée sur le droit de {user_country}."
                    "\n\nMENTION LÉGALE :"
                    "Rappelle toujours en fin de message que tes réponses ne remplacent pas une consultation avec un avocat."
                )

        if custom_instr:
            system_content += f"\n\nCONSIGNES SPÉCIFIQUES DE L'UTILISATEUR :\n{custom_instr}"

        if extracted_text:
            system_content += "\n\nUn document a été fourni, analyse son contenu précisément par rapport à la question."

        messages = [{"role": "system", "content": system_content}]

        # 2. Historique
        for msg in history[-6:]:
            role = "assistant" if msg.role == models.RoleEnum.assistant else "user"
            messages.append({"role": role, "content": msg.content})

        # 3. Contenu du message actuel
        if is_image:
            base64_image = encode_image(file_path)
            user_content = [
                {"type": "text", "text": question},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                }
            ]
            messages.append({"role": "user", "content": user_content})
        elif extracted_text:
            full_prompt = f"Contenu du document :\n{extracted_text}\n\nQuestion : {question}"
            messages.append({"role": "user", "content": full_prompt})
        else:
            messages.append({"role": "user", "content": question})

        chat_completion = client.chat.completions.create(
            messages=messages,
            model=model,
            temperature=0.3,
            max_tokens=2048,
        )

        return chat_completion.choices[0].message.content
    except Exception as e:
        print(f"Erreur Groq ({model if 'model' in locals() else 'unknown'}): {e}")
        if "Invalid API Key" in str(e):
            return "Erreur : La clé API Groq est invalide ou non configurée sur le serveur."
        return f"Désolée, je n'ai pas pu traiter votre demande (Erreur: {str(e)[:50]}...)"

@router.post("/ask", response_model=schemas.AskResponse)
async def ask_question(
    question: str = Form(...),
    conversation_id: int = Form(...),
    category: Optional[str] = Form("Droit Général"),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional)
):
    # Pour les invités (sans compte), on ne sauvegarde rien en base
    if not current_user:
        # On simule un historique vide pour les invités
        ai_content = call_groq_ai(question, [], None, None, category)
        return schemas.AskResponse(answer=ai_content, conversation_id=conversation_id)

    conv = db.query(models.Conversation).filter(
        models.Conversation.id == conversation_id,
        models.Conversation.user_id == current_user.id
    ).first()
    
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation non trouvée")
    
    # Gestion du fichier
    file_path = None
    if file:
        # Vérification extension
        ext = file.filename.split('.')[-1].lower()
        allowed_extensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'docx', 'doc']
        if ext not in allowed_extensions:
            return schemas.AskResponse(
                answer=f"Désolée, JURIVA ne supporte pas encore le format .{ext}. Formats acceptés : Images, PDF, Word.",
                conversation_id=conv.id
            )
            
        timestamp = int(datetime.now().timestamp())
        file_path = os.path.join(UPLOAD_DIR, f"{timestamp}_{file.filename}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

    # Sauvegarde du message utilisateur
    history_for_ia = list(conv.messages)
    
    user_msg = models.Message(
        conversation_id=conv.id,
        role=models.RoleEnum.user,
        content=question,
        file_path=file_path
    )
    db.add(user_msg)
    
    # Appel IA avec la catégorie
    ai_content = call_groq_ai(question, history_for_ia, current_user, file_path, category)
    
    # Sauvegarde réponse IA
    ai_msg = models.Message(
        conversation_id=conv.id,
        role=models.RoleEnum.assistant,
        content=ai_content
    )
    db.add(ai_msg)
    db.commit()
    
    return schemas.AskResponse(answer=ai_content, conversation_id=conv.id)

@router.post("/regenerate/{conversation_id}", response_model=schemas.AskResponse)
async def regenerate_response(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    conv = db.query(models.Conversation).filter(
        models.Conversation.id == conversation_id,
        models.Conversation.user_id == current_user.id
    ).first()

    if not conv or not conv.messages:
        raise HTTPException(status_code=404, detail="Conversation ou messages non trouvés")

    # Trouver le dernier message utilisateur
    last_user_msg = None
    history_before = []
    for msg in reversed(conv.messages):
        if msg.role == models.RoleEnum.user:
            last_user_msg = msg
            idx = conv.messages.index(msg)
            history_before = conv.messages[:idx]
            break

    if not last_user_msg:
        raise HTTPException(status_code=400, detail="Aucun message utilisateur à régénérer")

    # Supprimer les éventuelles réponses de l'IA qui suivaient ce message
    idx = conv.messages.index(last_user_msg)
    responses_to_delete = conv.messages[idx+1:]
    for r in responses_to_delete:
        db.delete(r)

    # Appel IA
    new_ai_content = call_groq_ai(last_user_msg.content, history_before, current_user, last_user_msg.file_path)

    # Sauvegarde nouvelle réponse IA
    new_ai_msg = models.Message(
        conversation_id=conv.id,
        role=models.RoleEnum.assistant,
        content=new_ai_content
    )
    db.add(new_ai_msg)
    db.commit()

    return schemas.AskResponse(answer=new_ai_content, conversation_id=conv.id)

@router.put("/messages/{message_id}", response_model=schemas.AskResponse)
async def update_user_message(
    message_id: int,
    new_content: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    msg = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message non trouvé")

    conv = db.query(models.Conversation).filter(
        models.Conversation.id == msg.conversation_id,
        models.Conversation.user_id == current_user.id
    ).first()

    if not conv:
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    # Mise à jour du message
    msg.content = new_content

    # Supprimer toutes les réponses IA qui suivaient ce message dans cette conversation
    idx = conv.messages.index(msg)
    following_messages = conv.messages[idx+1:]
    for f_msg in following_messages:
        db.delete(f_msg)

    # Recalculer l'historique avant ce message
    history_before = conv.messages[:idx]

    # Regénérer la réponse
    ai_content = call_groq_ai(new_content, history_before, current_user, msg.file_path)

    ai_msg = models.Message(
        conversation_id=conv.id,
        role=models.RoleEnum.assistant,
        content=ai_content
    )
    db.add(ai_msg)
    db.commit()

    return schemas.AskResponse(answer=ai_content, conversation_id=conv.id)

from fastapi.responses import FileResponse
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.colors import HexColor

@router.get("/conversations/{conversation_id}/export-pdf")
async def export_conversation_pdf(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    conv = db.query(models.Conversation).filter(
        models.Conversation.id == conversation_id,
        models.Conversation.user_id == current_user.id
    ).first()
    
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation non trouvée")

    pdf_filename = f"JURIVA_Expertise_{conversation_id}.pdf"
    pdf_path = os.path.join(UPLOAD_DIR, pdf_filename)
    
    doc = SimpleDocTemplate(pdf_path, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    # Styles personnalisés
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Title'],
        fontSize=22,
        textColor=HexColor("#2c3e50"),
        alignment=TA_CENTER,
        spaceAfter=20
    )
    
    user_msg_style = ParagraphStyle(
        'UserStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=HexColor("#3498db"),
        leftIndent=20,
        spaceBefore=10
    )
    
    bot_msg_style = ParagraphStyle(
        'BotStyle',
        parent=styles['Normal'],
        fontSize=11,
        textColor=HexColor("#2c3e50"),
        spaceBefore=15,
        spaceAfter=15,
        leading=14
    )

    # En-tête
    story.append(Paragraph("JURIVA - ASSISTANCE JURIDIQUE AI", title_style))
    story.append(Paragraph(f"Expertise générée le {datetime.now().strftime('%d/%m/%Y à %H:%M')}", styles['Italic']))
    story.append(Spacer(1, 20))

    # Contenu
    for msg in conv.messages:
        role_label = "<b>VOUS :</b>" if msg.role == models.RoleEnum.user else "<b>JURIVA :</b>"
        style = user_msg_style if msg.role == models.RoleEnum.user else bot_msg_style
        
        # Nettoyage Markdown sécurisé
        clean_content = markdown_to_pdf_html(msg.content)
        
        story.append(Paragraph(f"{role_label}<br/>{clean_content}", style))
        story.append(Spacer(1, 10))

    # Clause de non-responsabilité
    story.append(Spacer(1, 30))
    disclaimer = (
        "<hr/><i><b>Avertissement :</b> Ce document a été généré par une intelligence artificielle. "
        "Il est fourni à titre informatif et ne constitue pas un conseil juridique personnalisé. "
        "JURIVA recommande vivement de consulter un avocat pour valider ces informations.</i>"
    )
    story.append(Paragraph(disclaimer, styles['Italic']))

    doc.build(story)
    
    return FileResponse(pdf_path, filename=pdf_filename, media_type='application/pdf')

@router.post("/conversations", response_model=schemas.ConversationOut)
def create_conversation(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    new_conv = models.Conversation(user_id=current_user.id, title="Nouvelle discussion")
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)
    return new_conv

@router.put("/conversations/{conversation_id}", response_model=schemas.ConversationOut)
def update_conversation(
    conversation_id: int, 
    conv_update: schemas.ConversationUpdate,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    conv = db.query(models.Conversation).filter(
        models.Conversation.id == conversation_id, 
        models.Conversation.user_id == current_user.id
    ).first()
    if not conv: raise HTTPException(status_code=404, detail="Conversation non trouvée")
    
    conv.title = conv_update.title
    db.commit()
    db.refresh(conv)
    return conv

@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    conv = db.query(models.Conversation).filter(
        models.Conversation.id == conversation_id, 
        models.Conversation.user_id == current_user.id
    ).first()
    if not conv: raise HTTPException(status_code=404, detail="Conversation non trouvée")
    
    db.delete(conv)
    db.commit()
    return {"message": "Discussion supprimée définitivement"}

@router.get("/conversations", response_model=List[schemas.ConversationOut])
def get_conversations(db: Session = Depends(get_db), current_user: Optional[models.User] = Depends(auth.get_current_user_optional)):
    if not current_user:
        return []
    return db.query(models.Conversation).filter(models.Conversation.user_id == current_user.id).all()

@router.get("/conversations/{conversation_id}/messages", response_model=List[schemas.MessageOut])
def get_messages(conversation_id: int, db: Session = Depends(get_db), current_user: Optional[models.User] = Depends(auth.get_current_user_optional)):
    if not current_user:
        return []
    conv = db.query(models.Conversation).filter(models.Conversation.id == conversation_id, models.Conversation.user_id == current_user.id).first()
    if not conv: raise HTTPException(status_code=404, detail="Conversation non trouvée")
    return conv.messages
