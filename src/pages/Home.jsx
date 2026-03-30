import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  MessageSquare, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Trash2, 
  Edit2, 
  Moon, 
  Sun, 
  ChevronRight,
  User,
  ShieldCheck,
  Globe,
  Trash
} from 'lucide-react';
import ChatBox from '../components/ChatBox';

const API_URL = import.meta.env.VITE_API_URL || '';

const Home = ({ user = {}, onLogout, onOpenAuth }) => {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Droit Général');
  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [theme, setTheme] = useState(localStorage.getItem('juriva_theme') || 'light');
  
  const [notification, setNotification] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [confirmPassword, setConfirmPassword] = useState('');

  const categories = [
    { name: 'Droit Général', icon: <Globe size={18} /> },
    { name: 'Droit du Travail', icon: <User size={18} /> },
    { name: 'Droit des Affaires', icon: <ShieldCheck size={18} /> },
    { name: 'Droit Civil', icon: <MessageSquare size={18} /> },
    { name: 'Droit Immobilier', icon: <ChevronRight size={18} /> }
  ];

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('juriva_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const [editCountry, setEditCountry] = useState(user?.country || 'France');
  const [editLanguage, setEditLanguage] = useState(user?.language || 'Français');
  const [editInstructions, setEditInstructions] = useState(user?.custom_instructions || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEditCountry(user?.country || 'France');
    setEditLanguage(user?.language || 'Français');
    setEditInstructions(user?.custom_instructions || '');
  }, [user]);

  const handleSaveSettings = async () => {
    if (user?.isGuest) {
      showToast("Veuillez vous connecter pour modifier vos paramètres", "error");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL}/auth/update`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({ 
          country: editCountry, 
          language: editLanguage,
          custom_instructions: editInstructions 
        })
      });
      if (response.ok) {
        const updatedUser = await response.json();
        localStorage.setItem('juriva_user', JSON.stringify({ ...user, ...updatedUser }));
        showToast("Paramètres sauvegardés");
        setTimeout(() => window.location.reload(), 800);
      }
    } catch (err) { showToast("Erreur réseau", "error"); }
    finally { setIsSaving(false); }
  };

  const handleDeleteAccount = () => {
    setConfirmModal({
      title: "Supprimer le compte",
      message: "Cette action est irréversible. Toutes vos données seront perdues définitivement.",
      onConfirm: async (password) => {
        try {
          const response = await fetch(`${API_URL}/auth/delete`, {
            method: 'DELETE',
            headers: { 
              'Authorization': `Bearer ${user?.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
          });
          
          if (response.ok) {
            localStorage.removeItem('juriva_user');
            localStorage.removeItem('juriva_token');
            localStorage.removeItem(`juriva_chats_${user?.email || 'guest'}`);
            window.location.href = '/'; 
          } else {
            const data = await response.json();
            showToast(data.detail || "Erreur lors de la suppression", "error");
          }
        } catch (err) { showToast("Erreur réseau", "error"); }
      }
    });
  };

  const handleRenameChat = async (id) => {
    if (!editTitle.trim()) { setEditingChatId(null); return; }
    if (!user?.isGuest && user?.token) {
      try {
        const response = await fetch(`${API_URL}/chat/conversations/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user?.token}` },
          body: JSON.stringify({ title: editTitle })
        });
        if (response.ok) {
          setChats(prev => prev.map(c => c.id === id ? { ...c, title: editTitle } : c));
        }
      } catch (err) { console.error(err); }
    } else {
      setChats(prev => prev.map(c => c.id === id ? { ...c, title: editTitle } : c));
    }
    setEditingChatId(null);
  };

  const deleteChat = (e, id) => {
    e.stopPropagation();
    setConfirmModal({
      title: "Supprimer la discussion",
      message: "Voulez-vous supprimer cette discussion ?",
      onConfirm: async () => {
        if (!user?.isGuest && user?.token) {
          try { await fetch(`${API_URL}/chat/conversations/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${user?.token}` } }); }
          catch (err) { console.error(err); }
        }
        const filtered = chats.filter(c => c.id !== id);
        setChats(filtered);
        if (activeChatId === id) setActiveChatId(filtered.length > 0 ? filtered[0].id : null);
        showToast("Discussion supprimée");
        setConfirmModal(null);
      }
    });
  };

  const groupChatsByDate = (chatsList) => {
    const groups = { Today: [], Yesterday: [], Previous: [] };
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;

    chatsList.forEach(chat => {
      const chatDate = new Date(chat.created_at || Date.now()).getTime();
      if (chatDate >= today) groups.Today.push(chat);
      else if (chatDate >= yesterday) groups.Yesterday.push(chat);
      else groups.Previous.push(chat);
    });
    return groups;
  };

  useEffect(() => {
    const fetchChats = async () => {
      if (!user?.isGuest && user?.token) {
        try {
          const response = await fetch(`${API_URL}/chat/conversations`, {
            headers: { 'Authorization': `Bearer ${user?.token}` }
          });
          if (response.ok) {
            const data = await response.json();
            const formatted = data.map(c => ({ id: c.id, title: c.title || `Discussion #${c.id}`, created_at: c.created_at, messages: [] }));
            setChats(formatted.reverse());
            if (formatted.length > 0) setActiveChatId(formatted[0].id);
            return;
          }
        } catch (err) { console.error(err); }
      }
      
      const saved = localStorage.getItem(`juriva_chats_${user?.email || 'guest'}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setChats(parsed);
        if (parsed.length > 0) setActiveChatId(parsed[0].id);
      }
    };
    fetchChats();
  }, [user]);

  const updateChatMessages = useCallback((chatId, newMessages) => {
    setChats(prev => {
      const exists = prev.find(c => c.id === chatId);
      if (!exists) return prev;
      
      // Auto-titrage basé sur la première question si le titre est par défaut
      let updatedTitle = exists.title;
      if (newMessages.length > 0 && exists.title.includes('Nouvelle discussion')) {
        const firstUserMsg = newMessages.find(m => m.type === 'user');
        if (firstUserMsg) {
          const cat = exists.category || 'Droit';
          updatedTitle = `${cat} - ${firstUserMsg.text.substring(0, 30)}${firstUserMsg.text.length > 30 ? '...' : ''}`;
          // Optionnel: Mettre à jour sur le serveur aussi
          if (!user?.isGuest && user?.token) {
            fetch(`${API_URL}/chat/conversations/${chatId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user?.token}` },
              body: JSON.stringify({ title: updatedTitle })
            }).catch(e => console.error(e));
          }
        }
      }

      return prev.map(chat => chat.id === chatId ? { ...chat, messages: newMessages, title: updatedTitle } : chat);
    });
  }, [user]);

  useEffect(() => {
    if (!user?.isGuest && chats && chats.length > 0) {
      try {
        localStorage.setItem(`juriva_chats_${user?.email || 'guest'}`, JSON.stringify(chats));
      } catch (err) {
        console.error("Erreur de stockage local:", err);
      }
    }
  }, [chats, user?.isGuest, user?.email]);

  const createNewChat = async () => {
    let newChatId = Date.now();
    let finalTitle = newChatTitle.trim() || `Nouvelle discussion (${selectedCategory})`;
    
    if (!user?.isGuest && user?.token) {
      try {
        const response = await fetch(`${API_URL}/chat/conversations`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${user?.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: finalTitle })
        });
        if (response.ok) {
          const data = await response.json();
          newChatId = data.id;
        }
      } catch (err) { console.error(err); }
    }
    
    const newChat = { id: newChatId, title: finalTitle, messages: [], created_at: new Date().toISOString(), category: selectedCategory };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChatId);
    setShowCreateModal(false);
    setNewChatTitle('');
    if (window.innerWidth <= 768) setIsSidebarOpen(false);
  };

  const activeChat = chats.find(c => c.id === activeChatId);
  const groupedChats = groupChatsByDate(chats);

  const memoizedUpdate = useCallback((msgs) => {
    if (activeChatId) {
      updateChatMessages(activeChatId, msgs);
    }
  }, [activeChatId, updateChatMessages]);

  const countryFlags = { 
    // Francophones
    "Bénin": "🇧🇯", "Burkina Faso": "🇧🇫", "Cameroun": "🇨🇲", "Côte d'Ivoire": "🇨🇮", 
    "France": "🇫🇷", "Gabon": "🇬🇦", "Guinée": "🇬🇳", "Mali": "🇲🇱", 
    "Niger": "🇳🇪", "République du Congo": "🇨🇬", "Sénégal": "🇸🇳", 
    "Tchad": "🇹🇩", "Togo": "🇹🇬", "Belgique": "🇧🇪", "Suisse": "🇨🇭", "Canada (Québec)": "🇨🇦",
    // Anglophones
    "Nigeria": "🇳🇬", "Ghana": "🇬🇭", "Kenya": "🇰🇪", "South Africa": "🇿🇦", 
    "USA": "🇺🇸", "UK": "🇬🇧", "Canada (English)": "🇨🇦", "Australia": "🇦🇺",
    "India": "🇮🇳", "Liberia": "🇱🇷", "Sierra Leone": "🇸🇱"
  };

  const sidebarVariants = {
    open: { x: 0, opacity: 1, display: 'flex' },
    closed: { x: -300, opacity: 0, transitionEnd: { display: 'none' } }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-main)', position: 'relative', overflow: 'hidden' }}>
      
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
            style={{ position: 'fixed', bottom: '24px', right: '24px', padding: '12px 24px', backgroundColor: notification.type === 'error' ? '#ef4444' : '#10b981', color: 'white', borderRadius: '12px', boxShadow: 'var(--shadow-md)', zIndex: 2000, fontWeight: 'bold' }}>
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {window.innerWidth <= 768 && isSidebarOpen && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)', zIndex: 999 }} 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      <AnimatePresence>
        {confirmModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ backgroundColor: 'var(--bg-surface)', padding: '32px', borderRadius: '24px', width: '380px', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)' }}>
              <h3 style={{ marginTop: 0, fontSize: '1.4rem', color: 'var(--text-main)', marginBottom: '12px' }}>{confirmModal.title}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6' }}>{confirmModal.message}</p>
              
              {confirmModal.title === "Supprimer le compte" && (
                <div style={{ marginTop: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '8px' }}>MOT DE PASSE DE CONFIRMATION</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Entrez votre mot de passe"
                    style={{ 
                      width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', 
                      background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none' 
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button onClick={() => { setConfirmModal(null); setConfirmPassword(''); }} style={{ flex: 1, padding: '12px', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '12px', fontWeight: 'bold' }}>Annuler</button>
                <button onClick={() => confirmModal.onConfirm(confirmPassword)} disabled={confirmModal.title === "Supprimer le compte" && !confirmPassword} style={{ flex: 1, padding: '12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', opacity: (confirmModal.title === "Supprimer le compte" && !confirmPassword) ? 0.5 : 1 }}>Confirmer</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.aside 
        initial={false}
        animate={isSidebarOpen ? "open" : "closed"}
        variants={sidebarVariants}
        style={{ 
          width: '300px', backgroundColor: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', 
          position: window.innerWidth <= 768 ? 'fixed' : 'relative', zIndex: 1000, height: '100%' 
        }}>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="32" height="32" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="60" cy="60" r="55" fill="rgba(38,107,101,0.644)"/>
                <path d="M75 35 V70 C75 85 65 95 50 95 C40 95 32 90 28 82" stroke="white" stroke-width="6" stroke-linecap="round"/>
                <line x1="45" y1="50" x2="100" y2="50" stroke="white" stroke-width="4" stroke-linecap="round"/>
                <line x1="55" y1="50" x2="50" y2="65" stroke="#ffffff" stroke-width="2"/>
                <line x1="93.5" y1="50" x2="100" y2="65" stroke="white" stroke-width="2"/>
                <circle cx="50" cy="68" r="6" stroke="white" stroke-width="2" fill="none"/>
                <circle cx="100" cy="68" r="6" stroke="white" stroke-width="2" fill="none"/>
              </svg>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.5px', color: 'var(--accent)' }}>JURIVA</h1>
            </div>
            <span style={{ fontSize: '1.3rem' }}>{countryFlags[user?.country] || "🇫🇷"}</span>
          </div>
          <button onClick={() => { setActiveChatId(null); if (window.innerWidth <= 768) setIsSidebarOpen(false); }} style={{ width: '100%', padding: '14px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '14px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem', boxShadow: '0 4px 12px rgba(44, 62, 80, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <svg width="20" height="20" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="60" cy="60" r="55" fill="white"/>
              <path d="M75 35 V70 C75 85 65 95 50 95 C40 95 32 90 28 82" stroke="#1E3A8A" stroke-width="8" stroke-linecap="round"/>
              <line x1="45" y1="50" x2="85" y2="50" stroke="#1E3A8A" stroke-width="6" stroke-linecap="round"/>
            </svg>
            Nouveau Chat
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {['Today', 'Yesterday', 'Previous'].map(group => groupedChats[group].length > 0 && (
            <div key={group}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', padding: '16px 12px 8px', fontWeight: '700', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={12} /> {group === 'Today' ? "Aujourd'hui" : group === 'Yesterday' ? "Hier" : "Plus ancien"}
              </div>
              {groupedChats[group].map(chat => (
                <div key={chat.id} onClick={() => { setActiveChatId(chat.id); if (window.innerWidth <= 768) setIsSidebarOpen(false); }} 
                  style={{ 
                    padding: '12px 16px', 
                    marginBottom: '6px', 
                    borderRadius: '12px', 
                    cursor: 'pointer', 
                    backgroundColor: activeChatId === chat.id ? 'var(--bg-sidebar-active)' : 'transparent', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    transition: 'all 0.2s ease',
                    borderLeft: activeChatId === chat.id ? '3px solid var(--accent-light)' : '3px solid transparent',
                    boxShadow: activeChatId === chat.id ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                  }}
                  className="chat-item-hover">
                  {editingChatId === chat.id ? (
                    <input autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onBlur={() => handleRenameChat(chat.id)} onKeyPress={(e) => e.key === 'Enter' && handleRenameChat(chat.id)}
                      style={{ width: '100%', background: 'transparent', color: 'var(--text-inverse)', border: 'none', padding: '0', borderRadius: '4px', fontSize: '0.9rem', outline: 'none' }} />
                  ) : (
                    <>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-inverse)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, fontWeight: activeChatId === chat.id ? '700' : '500', opacity: activeChatId === chat.id ? 1 : 0.7 }}>{chat.title}</span>
                      <div style={{ display: 'flex', gap: '10px', opacity: activeChatId === chat.id ? 1 : 0, marginLeft: '8px' }}>
                        <Edit2 size={14} onClick={(e) => { e.stopPropagation(); setEditingChatId(chat.id); setEditTitle(chat.title); }} style={{ cursor: 'pointer', opacity: 0.6, color: 'var(--text-inverse)' }} />
                        <Trash2 size={14} onClick={(e) => deleteChat(e, chat.id)} style={{ cursor: 'pointer', opacity: 0.6, color: 'var(--text-inverse)' }} />
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-sidebar)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem' }}>
                <User size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-inverse)' }}>{user?.name || 'Invité'}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user?.isGuest ? 'Visiteur' : 'Expert'}</div>
              </div>
            </div>
            {!user?.isGuest && (
              <button onClick={() => setShowSettings(true)} style={{ background: 'var(--bg-sidebar-hover)', border: 'none', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Settings size={18} />
              </button>
            )}
          </div>
          {user?.isGuest ? (
            <button onClick={onOpenAuth} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <User size={16} /> Se connecter
            </button>
          ) : (
            <button onClick={onLogout} style={{ width: '100%', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <LogOut size={16} /> Déconnexion
            </button>
          )}
        </div>
      </motion.aside>

      <AnimatePresence>
        {showSettings && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <motion.div 
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              style={{ backgroundColor: 'var(--bg-surface)', padding: '32px', borderRadius: '28px', width: '420px', maxWidth: '90%', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800' }}>Paramètres</h2>
                <button onClick={() => setShowSettings(false)} style={{ background: 'var(--bg-main)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>Apparence</label>
                  <button onClick={toggleTheme} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    {theme === 'light' ? <><Moon size={18} /> Mode Sombre</> : <><Sun size={18} /> Mode Clair</>}
                  </button>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>Juridiction</label>
                  <div style={{ position: 'relative' }}>
                    <select value={editCountry} onChange={(e) => setEditCountry(e.target.value)} style={{ width: '100%', padding: '12px', paddingLeft: '40px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-main)', fontSize: '0.95rem', appearance: 'none' }}>
                      {Object.keys(countryFlags).map(c => <option key={c} value={c}>{countryFlags[c]} {c}</option>)}
                    </select>
                    <Globe size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>Langue de réponse</label>
                  <div style={{ position: 'relative' }}>
                    <select value={editLanguage} onChange={(e) => setEditLanguage(e.target.value)} style={{ width: '100%', padding: '12px', paddingLeft: '40px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-main)', fontSize: '0.95rem', appearance: 'none' }}>
                      <option value="Français">🇫🇷 Français</option>
                      <option value="English">🇬🇧 English</option>
                    </select>
                    <Globe size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>Instructions personnalisées</label>
                  <div style={{ position: 'relative' }}>
                    <textarea value={editInstructions} onChange={(e) => setEditInstructions(e.target.value)} placeholder="Ex: Sois très bref et cite des articles de loi..." style={{ width: '100%', height: '100px', padding: '12px', paddingLeft: '40px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-main)', resize: 'none', fontSize: '0.9rem', outline: 'none' }} />
                    <Edit2 size={18} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-muted)' }} />
                  </div>
                </div>
                <button onClick={handleSaveSettings} disabled={isSaving} style={{ padding: '14px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <ShieldCheck size={20} /> {isSaving ? 'Enregistrement...' : 'Sauvegarder'}
                </button>
                <button onClick={handleDeleteAccount} style={{ padding: '8px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Trash size={14} /> Supprimer mon compte
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ display: isSidebarOpen && window.innerWidth > 1024 ? 'none' : 'flex', padding: '16px 20px', backgroundColor: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)', alignItems: 'center', gap: '16px', zIndex: 50 }}>
          <button onClick={() => setIsSidebarOpen(true)} style={{ background: 'var(--bg-sidebar-hover)', border: 'none', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-inverse)' }}>
            <Menu size={24} />
          </button>
          <span style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeChat?.title || 'JURIVA'}</span>
        </div>

        {activeChat ? (
          <div style={{ flex: 1, maxWidth: '900px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', padding: '0 20px', minHeight: 0 }}>
            <ChatBox 
              key={activeChat.id} 
              chatId={activeChat.id} 
              messages={activeChat.messages} 
              user={user} 
              onUpdateMessages={memoizedUpdate} 
            />
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center', overflowY: 'auto' }}>
            <div style={{ maxWidth: '600px', width: '100%' }}>
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                style={{ marginBottom: '24px' }}
              >
                <svg width="100" height="100" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 10px 15px rgba(38, 107, 101, 0.2))' }}>
                  <circle cx="60" cy="60" r="55" fill="rgba(38, 107, 101, 0.644)"/>
                  <path d="M75 35 V70 C75 85 65 95 50 95 C40 95 32 90 28 82" stroke="white" stroke-width="6" stroke-linecap="round"/>
                  <line x1="45" y1="50" x2="100" y2="50" stroke="white" stroke-width="4" stroke-linecap="round"/>
                  <line x1="55" y1="50" x2="50" y2="65" stroke="#ffffff" stroke-width="2"/>
                  <line x1="93.5" y1="50" x2="100" y2="65" stroke="white" stroke-width="2"/>
                  <circle cx="50" cy="68" r="6" stroke="white" stroke-width="2" fill="none"/>
                  <circle cx="100" cy="68" r="6" stroke="white" stroke-width="2" fill="none"/>
                </svg>
              </motion.div>
              <motion.h2 
                initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                style={{ fontSize: window.innerWidth <= 768 ? '3rem' : '4.5rem', fontWeight: '900', marginBottom: '16px', letterSpacing: '-3px', color: 'var(--accent)', textShadow: '0 10px 30px rgba(30, 64, 175, 0.1)' }}>JURIVA</motion.h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '40px', fontSize: '1.2rem', lineHeight: '1.6', fontWeight: '500' }}>Votre assistant juridique personnel intelligent.<br/>Expert en droit des affaires, du travail et civil.</p>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', marginBottom: '40px', opacity: 0.7 }}>
                {categories.map(cat => (
                  <span key={cat.name} style={{ padding: '8px 16px', borderRadius: '20px', background: 'var(--bg-sidebar-hover)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border)' }}>
                    {cat.icon} {cat.name}
                  </span>
                ))}
              </div>

              <motion.button 
                whileHover={{ scale: 1.05, boxShadow: '0 15px 30px rgba(30, 64, 175, 0.2)' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => createNewChat()}
                style={{ 
                  padding: '20px 40px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', 
                  borderRadius: '20px', cursor: 'pointer', fontWeight: '800', fontSize: '1.2rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', margin: '0 auto'
                }}
              >
                <Plus size={24} /> Nouvelle discussion
              </motion.button>
            </div>
          </motion.div>
        )}
      </main>

      <AnimatePresence>
        {showCreateModal && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ backgroundColor: 'var(--bg-surface)', padding: '32px', borderRadius: '28px', width: '450px', maxWidth: '90%', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>Nouveau Chat Expert</h2>
                <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={24} /></button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '12px' }}>DOMAINE D'EXPERTISE</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    {categories.map(cat => (
                      <button 
                        key={cat.name}
                        onClick={() => setSelectedCategory(cat.name)}
                        style={{ 
                          padding: '12px', borderRadius: '12px', border: '1px solid', 
                          borderColor: selectedCategory === cat.name ? 'var(--accent)' : 'var(--border)',
                          background: selectedCategory === cat.name ? 'var(--accent-soft)' : 'var(--bg-main)',
                          color: selectedCategory === cat.name ? 'var(--accent)' : 'var(--text-main)',
                          fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px',
                          transition: 'all 0.2s'
                        }}
                      >
                        {cat.icon} {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>TITRE (OPTIONNEL)</label>
                  <input 
                    type="text" 
                    value={newChatTitle}
                    onChange={(e) => setNewChatTitle(e.target.value)}
                    placeholder="Laissez vide pour un titre automatique"
                    style={{ 
                      width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', 
                      background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none' 
                    }}
                  />
                </div>

                <button 
                  onClick={createNewChat}
                  style={{ 
                    padding: '16px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', 
                    borderRadius: '14px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', marginTop: '10px'
                  }}
                >
                  Démarrer la consultation
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .chat-item-hover:hover {
          background-color: var(--bg-sidebar-hover) !important;
        }
        @media (max-width: 1024px) {
          main > div:first-child { display: flex !important; }
        }
      `}</style>
    </div>
  );
};

export default Home;
