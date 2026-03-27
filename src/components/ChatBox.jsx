import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Paperclip, 
  Copy, 
  RotateCcw, 
  FileText, 
  Edit3, 
  Check, 
  AlertCircle,
  Download,
  MoreVertical,
  X,
  ShieldCheck
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

// Composant pour l'effet d'affichage par paragraphe - Stable et confortable
const TypingMessage = ({ text = "", onComplete, onUpdate }) => {
  const [visibleCount, setVisibleCount] = useState(0);
  const paragraphs = (text || "").split(/\n\s*\n/).filter(p => p.trim() !== "");

  useEffect(() => {
    if (!text) return;
    if (visibleCount < paragraphs.length) {
      const timer = setTimeout(() => {
        setVisibleCount(prev => prev + 1);
        if (onUpdate) onUpdate();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      if (onComplete) onComplete();
    }
  }, [visibleCount, paragraphs, onComplete, onUpdate, text]);

  return (
    <div className="typing-container" style={{ width: '100%' }}>
      {paragraphs.map((p, i) => (
        <motion.div 
          key={i} 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: i < visibleCount ? 1 : 0, y: i < visibleCount ? 0 : 10 }}
          transition={{ duration: 0.4 }}
          style={{ 
            marginBottom: i < paragraphs.length - 1 ? '1.2em' : '0'
          }}>
          <ReactMarkdown>{p}</ReactMarkdown>
        </motion.div>
      ))}
    </div>
  );
};

const ChatBox = ({ chatId, category, messages = [], onUpdateMessages, user }) => {
  const [input, setInput] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [newBotMsgId, setNewBotMsgId] = useState(null);

  const scrollContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const isAutoScrollRef = useRef(true);
  const lastScrollTopRef = useRef(0);

  const scrollToBottom = useCallback((force = false) => {
    if (messagesEndRef.current && (isAutoScrollRef.current || force)) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      if (scrollTop < lastScrollTopRef.current) isAutoScrollRef.current = false;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      if (isAtBottom) isAutoScrollRef.current = true;
      lastScrollTopRef.current = scrollTop;
    }
  };

  useEffect(() => {
    const fetchMessages = async () => {
      if (!user?.token || user.isGuest) return;
      try {
        const response = await fetch(`${API_URL}/chat/conversations/${chatId}/messages`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        });
        if (response.ok) {
          const data = await response.json();
          const formatted = data.map(m => ({
            id: m.id,
            type: m.role === 'assistant' ? 'bot' : 'user',
            text: m.content,
            file_name: m.file_path ? m.file_path.split('_').slice(1).join('_') : null
          }));
          onUpdateMessages(formatted);
          setTimeout(() => scrollToBottom(true), 100);
        }
      } catch (err) { console.error(err); }
    };
    fetchMessages();
  }, [chatId, user?.token, user?.isGuest, onUpdateMessages, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const handleSend = async () => {
    if ((!input.trim() && !file) || loading) return;

    const currentInput = input;
    const currentFile = file;
    const formData = new FormData();
    formData.append('question', currentInput || "Analyse ce document");
    formData.append('conversation_id', chatId);
    formData.append('category', category || 'Droit Général');
    if (currentFile) formData.append('file', currentFile);

    setLoading(true);
    setError('');
    setInput('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    isAutoScrollRef.current = true;
    setTimeout(() => scrollToBottom(true), 50);

    try {
      const response = await fetch(`${API_URL}/chat/ask`, {
        method: 'POST',
        headers: user?.token ? { 'Authorization': `Bearer ${user.token}` } : {},
        body: formData,
      });

      if (!response.ok) throw new Error("Erreur serveur");
      const data = await response.json();

      const newUserMsg = { id: Date.now(), type: 'user', text: currentInput || "Analyse ce document", file_name: currentFile ? currentFile.name : null };
      const newBotMsg = { id: data.id || Date.now() + 1, type: 'bot', text: data.answer };

      setNewBotMsgId(newBotMsg.id);
      onUpdateMessages([...messages, newUserMsg, newBotMsg]);
    } catch (err) {
      setError(`Erreur : ${err.message}`);
      setInput(currentInput);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
  };

  const handleRegenerate = async () => {
    if (loading || user.isGuest) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/chat/regenerate/${chatId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const updatedMessages = [...messages];
        if (updatedMessages.length > 0 && updatedMessages[updatedMessages.length - 1].type === 'bot') {
            const newId = data.id || Date.now();
            updatedMessages[updatedMessages.length - 1] = { ...updatedMessages[updatedMessages.length - 1], text: data.answer, id: newId };
            setNewBotMsgId(newId);
            onUpdateMessages(updatedMessages);
        }
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const startEditing = (msg) => {
    setEditingMsgId(msg.id);
    setEditValue(msg.text);
  };

  const saveEdit = async (msgId) => {
    if (!editValue.trim() || user.isGuest) return;
    setLoading(true);
    setEditingMsgId(null);
    const formData = new FormData();
    formData.append('new_content', editValue);

    try {
      const response = await fetch(`${API_URL}/chat/messages/${msgId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${user.token}` },
        body: formData
      });
      if (response.ok) {
        const data = await response.json();
        const idx = messages.findIndex(m => m.id === msgId);
        const newMessages = messages.slice(0, idx);
        const editedUserMsg = { ...messages[idx], text: editValue };
        const newBotMsg = { id: Date.now(), type: 'bot', text: data.answer };
        onUpdateMessages([...newMessages, editedUserMsg, newBotMsg]);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleExportPDF = () => {
    const token = user?.token || '';
    window.open(`${API_URL}/chat/conversations/${chatId}/export-pdf?token=${token}`, '_blank');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, width: '100%' }} className="chat-container">
      
      {/* Header Chat - Plus compact sur mobile */}
      <div className="chat-header" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
        <motion.button 
          whileHover={{ scale: 1.02, backgroundColor: 'var(--bg-main)' }}
          whileTap={{ scale: 0.98 }}
          onClick={handleExportPDF} 
          style={{ padding: '6px 12px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: 'var(--shadow-sm)' }}>
          <Download size={14} className="text-accent" /> <span className="hide-mobile">Exporter</span> PDF
        </motion.button>
      </div>

      {/* Zone des messages - Padding réduit sur mobile */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="messages-zone"
        style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '20px' }}
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, index) => (
            <motion.div 
              key={msg.id || index} 
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
              style={{ 
                alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start',
                width: '100%',
                display: 'flex',
                justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              <div 
                className="message-bubble"
                style={{ 
                  maxWidth: '92%', 
                  padding: '12px 16px', 
                  borderRadius: msg.type === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  backgroundColor: msg.type === 'user' ? 'var(--chat-user)' : 'var(--bg-surface)',
                  color: msg.type === 'user' ? 'white' : 'var(--text-main)',
                  boxShadow: msg.type === 'user' ? '0 4px 12px rgba(30, 64, 175, 0.15)' : 'var(--shadow-sm)',
                  border: msg.type === 'user' ? 'none' : '1px solid var(--border)',
                  fontSize: '0.95rem',
                  lineHeight: '1.5',
                  position: 'relative'
                }}
              >
                <div className="markdown-content">
                  {editingMsgId === msg.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <textarea 
                        value={editValue} 
                        onChange={(e) => setEditValue(e.target.value)}
                        style={{ width: '100%', minHeight: '80px', padding: '12px', borderRadius: '12px', border: '2px solid var(--accent)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none' }}
                      />
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditingMsgId(null)} style={{ padding: '8px 16px', fontSize: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>Annuler</button>
                        <button onClick={() => saveEdit(msg.id)} style={{ padding: '8px 16px', fontSize: '0.75rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--accent)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Sauvegarder</button>
                      </div>
                    </div>
                  ) : (
                    msg.type === 'bot' && msg.id === newBotMsgId ? (
                      <TypingMessage text={msg.text} onUpdate={() => scrollToBottom()} onComplete={() => setNewBotMsgId(null)} />
                    ) : (
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    )
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '10px', opacity: 0.6, fontSize: '0.7rem', justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '8px' }}>
                  <span onClick={() => handleCopy(msg.text)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Copy size={12} /> Copier
                  </span>
                  {msg.type === 'user' && !user.isGuest && (
                    <span onClick={() => startEditing(msg)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Edit3 size={12} /> Modif.
                    </span>
                  )}
                  {msg.type === 'bot' && index === messages.length - 1 && !loading && !user.isGuest && (
                    <span onClick={handleRegenerate} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <RotateCcw size={12} /> Régen.
                    </span>
                  )}
                  {msg.file_name && (
                    <span style={{ fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent)' }}>
                      <FileText size={12} /> {msg.file_name}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '12px 16px', backgroundColor: 'var(--bg-surface)', borderRadius: '18px', border: '1px solid var(--border)' }}>
            <div className="typing-dot" /> <div className="typing-dot" /> <div className="typing-dot" />
            <span>JURIVA analyse...</span>
          </motion.div>
        )}
        <div ref={messagesEndRef} style={{ height: '1px' }} />
      </div>

      {/* Input Area - Optimisée pour éviter le scroll global */}
      <div className="input-area" style={{ padding: '12px 0 20px' }}>
        <div style={{ 
          backgroundColor: 'var(--bg-surface)', 
          border: '1px solid var(--border)', 
          borderRadius: '24px', 
          padding: '6px',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }} className="input-container-focus">
          {file && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ padding: '6px 12px', backgroundColor: 'rgba(30, 64, 175, 0.05)', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '2px', border: '1px solid rgba(30, 64, 175, 0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={14} className="text-accent" />
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
              </div>
              <button onClick={() => setFile(null)} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
            </motion.div>
          )}

          <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end' }}>
            <button 
              onClick={() => fileInputRef.current.click()} 
              style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: '14px', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <Paperclip size={20} />
            </button>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => setFile(e.target.files[0])} accept="image/*,.pdf,.doc,.docx" />
            
            <textarea
              style={{ flex: 1, padding: '10px 4px', border: 'none', background: 'transparent', color: 'var(--text-main)', fontSize: '1rem', outline: 'none', resize: 'none', maxHeight: '120px', minHeight: '40px', lineHeight: '1.4' }}
              placeholder="Votre question..."
              rows="1"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={handleSend} disabled={loading || (!input.trim() && !file)} 
              style={{ 
                width: '40px', height: '40px', backgroundColor: (loading || (!input.trim() && !file)) ? 'var(--bg-main)' : 'var(--accent)', 
                color: (loading || (!input.trim() && !file)) ? 'var(--text-muted)' : 'white', 
                border: 'none', borderRadius: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' 
              }}>
              <Send size={18} />
            </motion.button>
          </div>
        </div>
      </div>

      <style>{`
        .icon-btn:hover { background-color: var(--bg-main) !important; color: var(--accent) !important; }
        .typing-dot { width: 4px; height: 4px; background-color: var(--text-muted); borderRadius: 50%; animation: dot-blink 1.4s infinite; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dot-blink { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 1; transform: scale(1.2); } }
        .markdown-content ul, .markdown-content ol { padding-left: 18px; margin: 8px 0; }
        .markdown-content li { margin-bottom: 4px; }
        .markdown-content p { margin-bottom: 8px; }
        .markdown-content p:last-child { margin-bottom: 0; }
        
        @media (max-width: 768px) {
          .hide-mobile { display: none; }
          .message-bubble { max-width: 95% !important; padding: 10px 12px !important; }
          .messages-zone { padding: 10px 0 !important; gap: 16px !important; }
          .input-area { padding: 8px 0 12px !important; }
          .markdown-content { font-size: 0.95rem !important; }
        }
      `}</style>
    </div>
  );
};

export default ChatBox;
