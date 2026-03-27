import { useState, useEffect } from 'react';
import Home from './pages/Home';
import Auth from './pages/Auth';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('juriva_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    } else {
      // Utilisateur par défaut (invité) pour un accès direct au chat
      setUser({ isGuest: true, name: 'Utilisateur', email: 'guest', country: 'France' });
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('juriva_user', JSON.stringify(userData));
    setShowAuth(false);
  };

  const handleLogout = () => {
    const guestUser = { isGuest: true, name: 'Utilisateur', email: 'guest', country: 'France' };
    setUser(guestUser);
    localStorage.removeItem('juriva_user');
  };

  if (loading) return null;

  return (
    <div className="App">
      {showAuth ? (
        <Auth onLogin={handleLogin} onCancel={() => setShowAuth(false)} />
      ) : (
        <Home user={user} onLogout={handleLogout} onOpenAuth={() => setShowAuth(true)} />
      )}
    </div>
  );
}

export default App;
