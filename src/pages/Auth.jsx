import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Globe, ChevronLeft, ArrowRight, ShieldCheck, X, CheckCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

const Auth = ({ onLogin, onCancel, initialView = 'login' }) => {
  const [view, setView] = useState(initialView); // 'login', 'register', 'forgot', 'reset'
  
  // Extraire l'email de l'URL si présent (cas du reset)
  const urlParams = new URLSearchParams(window.location.search);
  const initialEmail = urlParams.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('France');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const changeView = (newView) => {
    setError('');
    setMessage('');
    setView(newView);
  };

  const countryFlags = { 
    // ... (reste des drapeaux)
    "Bénin": "🇧🇯", "Burkina Faso": "🇧🇫", "Cameroun": "🇨🇲", "Côte d'Ivoire": "🇨🇮", 
    "France": "🇫🇷", "Gabon": "🇬🇦", "Guinée": "🇬🇳", "Mali": "🇲🇱", 
    "Niger": "🇳🇪", "République du Congo": "🇨🇬", "Sénégal": "🇸🇳", 
    "Tchad": "🇹🇩", "Togo": "🇹🇬", "Belgique": "🇧🇪", "Suisse": "🇨🇭", "Canada (Québec)": "🇨🇦",
    // Anglophones
    "Nigeria": "🇳🇬", "Ghana": "🇬🇭", "Kenya": "🇰🇪", "South Africa": "🇿🇦", 
    "USA": "🇺🇸", "UK": "🇬🇧", "Canada (English)": "🇨🇦", "Australia": "🇦🇺",
    "India": "🇮🇳", "Liberia": "🇱🇷", "Sierra Leone": "🇸🇱"
  };
  const countries = Object.keys(countryFlags);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (view === 'register' && password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (view === 'reset' && password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);

    if (view === 'forgot') {
      await handleForgotPassword();
      return;
    }

    if (view === 'reset') {
      await handleResetPassword();
      return;
    }

    const endpoint = view === 'login' ? '/auth/login' : '/auth/register';
    let body;
    let headers = { 'Content-Type': 'application/json' };

    if (view === 'login') {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);
      body = formData;
      headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    } else {
      body = JSON.stringify({ email, password, display_name: name, country: country });
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: headers,
        body: body,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Une erreur est survenue');

      if (view === 'login') {
        const userResponse = await fetch(`${API_URL}/auth/me`, {
          headers: { 'Authorization': `Bearer ${data.access_token}` }
        });
        const userData = await userResponse.json();
        onLogin({ email: userData.email, token: data.access_token, name: userData.display_name || userData.email.split('@')[0], country: userData.country });
      } else {
        setView('login');
        setMessage('Compte créé avec succès !');
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleForgotPassword = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage('Un lien de réinitialisation a été envoyé à votre adresse e-mail.');
      } else {
        setError(data.detail || 'Cet e-mail est inconnu.');
      }
    } catch (err) { setError('Erreur réseau.'); }
    finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, new_password: password }),
      });
      if (response.ok) {
        setView('login');
        setMessage('Mot de passe réinitialisé ! Connectez-vous.');
      } else {
        setError('Erreur lors de la réinitialisation.');
      }
    } catch (err) { setError('Erreur réseau.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)', position: 'relative', overflow: 'hidden' }}>
      <motion.button whileHover={{ scale: 1.1 }} onClick={onCancel} style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--bg-surface)', border: '1px solid var(--border)', width: '44px', height: '44px', borderRadius: '14px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
        <X size={24} />
      </motion.button>

      <motion.div key={view} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%', maxWidth: '450px', padding: '40px', backgroundColor: 'var(--bg-surface)', borderRadius: '32px', boxShadow: 'var(--shadow-lg)', textAlign: 'center', border: '1px solid var(--border)', zIndex: 5 }}>
        
        <div style={{ marginBottom: '32px' }}>
          <div style={{ width: '60px', height: '60px', backgroundColor: 'var(--accent-soft)', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--accent)' }}>
            {view === 'reset' ? <CheckCircle size={32} /> : <ShieldCheck size={32} />}
          </div>
          <h1 style={{ color: 'var(--accent)', fontSize: '2.5rem', fontWeight: '900', marginBottom: '8px', letterSpacing: '-1.5px' }}>JURIVA</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: '600' }}>
            {view === 'login' ? 'Expertise Juridique Intelligente' : view === 'register' ? 'Rejoignez l\'élite juridique' : view === 'forgot' ? 'Vérification de compte' : 'Nouveau mot de passe'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {view === 'register' && (
            <>
              <div style={{ position: 'relative' }}>
                <User size={18} style={iconInputStyle} />
                <input type="text" placeholder="Nom complet" required style={inputWithIconStyle} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', marginLeft: '4px', marginBottom: '6px', display: 'block', letterSpacing: '0.5px' }}>JURIDICTION</label>
                <div style={{ position: 'relative' }}>
                  <Globe size={18} style={iconInputStyle} />
                  <select style={{ ...inputWithIconStyle, width: '100%', appearance: 'none' }} value={country} onChange={(e) => setCountry(e.target.value)}>
                    {countries.map(c => <option key={c} value={c}>{countryFlags[c]} {c}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {(view === 'login' || view === 'register' || view === 'forgot') && (
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={iconInputStyle} />
              <input type="email" placeholder="Adresse email" required disabled={view === 'reset'} style={inputWithIconStyle} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          )}

          {(view === 'login' || view === 'register' || view === 'reset') && (
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={iconInputStyle} />
              <input type="password" placeholder={view === 'reset' ? "Nouveau mot de passe" : "Mot de passe"} required style={inputWithIconStyle} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}

          {(view === 'register' || view === 'reset') && (
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={iconInputStyle} />
              <input type="password" placeholder="Confirmer le mot de passe" required style={inputWithIconStyle} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          )}

          {view === 'login' && (
            <div style={{ textAlign: 'right' }}>
              <span onClick={() => changeView('forgot')} style={{ fontSize: '0.85rem', color: 'var(--accent)', cursor: 'pointer', fontWeight: '700' }}>Mot de passe oublié ?</span>
            </div>
          )}

          {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: '700' }}>{error}</p>}
          {message && <p style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '700' }}>{message}</p>}

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={loading} style={{ ...buttonStyle, backgroundColor: loading ? 'var(--text-muted)' : 'var(--accent)' }}>
            {loading ? 'Traitement...' : (view === 'login' ? 'Se connecter' : view === 'register' ? "Créer mon compte" : view === 'forgot' ? "Vérifier l'email" : "Mettre à jour le mot de passe")}
            {!loading && <ArrowRight size={18} style={{ marginLeft: '8px' }} />}
          </motion.button>
        </form>

        <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
          {view === 'forgot' || view === 'reset' ? (
            <p onClick={() => changeView('login')} style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <ChevronLeft size={18} /> Retour à la connexion
            </p>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: '600' }}>
              {view === 'login' ? "Nouveau sur JURIVA ?" : "Déjà un compte ?"}
              <span onClick={() => changeView(view === 'login' ? 'register' : 'login')} style={{ color: 'var(--accent)', cursor: 'pointer', marginLeft: '8px', fontWeight: '800', textDecoration: 'underline' }}>
                {view === 'login' ? "S'inscrire" : "Se connecter"}
              </span>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const iconInputStyle = { position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 };
const inputWithIconStyle = { padding: '16px 16px 16px 48px', borderRadius: '16px', border: '1px solid var(--border)', fontSize: '1rem', outline: 'none', width: '100%', boxSizing: 'border-box', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', transition: 'all 0.2s', fontWeight: '500' };
const buttonStyle = { padding: '18px', borderRadius: '16px', border: 'none', color: 'white', fontSize: '1.05rem', fontWeight: '800', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' };

export default Auth;
