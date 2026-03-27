import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || '';

const Auth = ({ onLogin, onCancel }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('France');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const countries = [
    "Bénin", "Burkina Faso", "Cameroun", "Côte d'Ivoire", "France", 
    "Gabon", "Guinée", "Mali", "Niger", "République du Congo", 
    "Sénégal", "Tchad", "Togo"
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    let body;
    let headers = { 'Content-Type': 'application/json' };

    if (isLogin) {
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

      if (isLogin) {
        const userResponse = await fetch(`${API_URL}/auth/me`, {
          headers: { 'Authorization': `Bearer ${data.access_token}` }
        });
        const userData = await userResponse.json();
        
        onLogin({ 
          email: userData.email, 
          token: data.access_token, 
          name: userData.display_name || userData.email.split('@')[0],
          country: userData.country
        });
      } else {
        setIsLogin(true);
        setError('Compte créé ! Connectez-vous.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', 
      backgroundColor: 'var(--bg-main)', position: 'relative'
    }}>
      <motion.button 
        whileHover={{ scale: 1.1 }}
        onClick={onCancel}
        style={{ 
          position: 'absolute', top: '24px', right: '24px', background: 'var(--white)', border: '1px solid var(--border)', 
          width: '40px', height: '40px', borderRadius: '50%', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)'
        }}
      >
        ×
      </motion.button>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ 
          width: '100%', maxWidth: '420px', padding: '48px', backgroundColor: 'var(--white)', 
          borderRadius: '32px', boxShadow: '0 20px 50px rgba(0,0,0,0.08)', textAlign: 'center',
          border: '1px solid var(--border)'
        }}>
        
        <h1 style={{ color: 'var(--accent)', fontSize: '2.2rem', fontWeight: '900', marginBottom: '8px', letterSpacing: '-1px' }}>JURIVA</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '1rem', fontWeight: '500' }}>
          {isLogin ? 'Content de vous revoir' : 'Commencez votre expertise'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <AnimatePresence mode="wait">
            {!isLogin && (
              <motion.div 
                key="register-fields"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}
              >
                <input
                  type="text" placeholder="Nom complet" required
                  style={inputStyle} value={name} onChange={(e) => setName(e.target.value)}
                />
                <div style={{ textAlign: 'left' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginLeft: '4px', marginBottom: '4px', display: 'block' }}>JURIDICTION</label>
                  <select 
                    style={{ ...inputStyle, width: '100%' }}
                    value={country} onChange={(e) => setCountry(e.target.value)}
                  >
                    {countries.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <input
            type="email" placeholder="Adresse email" required
            style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password" placeholder="Mot de passe" required
            style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <motion.p 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: '600', margin: '4px 0' }}>
              {error}
            </motion.p>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit" disabled={loading}
            style={{ 
              ...buttonStyle,
              backgroundColor: loading ? 'var(--text-muted)' : 'var(--accent)',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 10px 20px rgba(44, 62, 80, 0.2)'
            }}
          >
            {loading ? 'Traitement...' : (isLogin ? 'Se connecter' : "Créer mon compte")}
          </motion.button>
        </form>

        <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '500' }}>
            {isLogin ? "Nouveau sur JURIVA ?" : "Déjà un compte ?"}
            <span 
              onClick={() => setIsLogin(!isLogin)}
              style={{ color: 'var(--accent)', cursor: 'pointer', marginLeft: '8px', fontWeight: '700', textDecoration: 'underline' }}
            >
              {isLogin ? "S'inscrire" : "Se connecter"}
            </span>
          </p>
          
          <button 
            onClick={onCancel}
            style={{ 
              marginTop: '16px', background: 'none', border: 'none', color: 'var(--text-muted)', 
              fontSize: '0.85rem', cursor: 'pointer', fontWeight: '600'
            }}
          >
            Continuer sans compte
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const inputStyle = {
  padding: '14px 18px',
  borderRadius: '14px',
  border: '1px solid var(--border)',
  fontSize: '1rem',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: 'var(--bg-main)',
  color: 'var(--text-main)',
  transition: 'all 0.2s'
};

const buttonStyle = {
  padding: '16px',
  borderRadius: '14px',
  border: 'none',
  color: 'white',
  fontSize: '1rem',
  fontWeight: '800',
  marginTop: '8px',
  transition: 'all 0.3s'
};

export default Auth;
