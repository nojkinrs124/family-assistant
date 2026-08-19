'use client';
import { useState, useRef, useEffect } from 'react';

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    background: '#0f172a',
    color: '#f1f5f9',
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: '#0f172a',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerIcon: {
    fontSize: 28,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 600,
    color: '#f1f5f9',
    margin: 0,
  },
  headerSub: {
    fontSize: 12,
    color: '#64748b',
    margin: 0,
    marginTop: 2,
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  bubble: (isUser) => ({
    maxWidth: '80%',
    alignSelf: isUser ? 'flex-end' : 'flex-start',
    background: isUser ? '#2563eb' : '#1e293b',
    color: '#f1f5f9',
    padding: '12px 16px',
    borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
    fontSize: 15,
    lineHeight: 1.5,
    wordBreak: 'break-word',
  }),
  time: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
    marginTop: 4,
  },
  typing: {
    alignSelf: 'flex-start',
    background: '#1e293b',
    padding: '12px 16px',
    borderRadius: '18px 18px 18px 4px',
    display: 'flex',
    gap: 4,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#64748b',
  },
  inputArea: {
    padding: '12px 16px',
    borderTop: '1px solid #1e293b',
    display: 'flex',
    gap: 10,
    alignItems: 'flex-end',
    background: '#0f172a',
  },
  input: {
    flex: 1,
    background: '#1e293b',
    border: 'none',
    borderRadius: 22,
    padding: '12px 18px',
    color: '#f1f5f9',
    fontSize: 15,
    outline: 'none',
    resize: 'none',
    maxHeight: 120,
    lineHeight: 1.5,
    fontFamily: 'inherit',
  },
  sendBtn: (disabled) => ({
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: disabled ? '#1e293b' : '#2563eb',
    border: 'none',
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.2s',
  }),
  quickActions: {
    display: 'flex',
    gap: 8,
    padding: '0 16px 12px',
    overflowX: 'auto',
    scrollbarWidth: 'none',
  },
  chip: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 20,
    padding: '8px 14px',
    fontSize: 13,
    color: '#94a3b8',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
};

const QUICK = [
  '🥛 Молоко, хлеб, яйца',
  '🥩 Мясо на неделю',
  '🥦 Овощи и фрукты',
  '🧴 Средства гигиены',
];

const WELCOME = {
  id: 0,
  role: 'assistant',
  content: 'Привет! Напиши что нужно купить в Ленте — я помогу составить корзину 🛒',
};

export default function Home() {
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg = { id: Date.now(), role: 'user', content: msg };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.filter(m => m.id !== 0).map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.reply,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Не удалось подключиться. Проверь интернет и попробуй снова.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div style={styles.root}>
      {/* Шапка */}
      <div style={styles.header}>
        <span style={styles.headerIcon}>🛒</span>
        <div style={styles.headerText}>
          <p style={styles.headerTitle}>Семейный помощник</p>
          <p style={styles.headerSub}>Лента · Красноярск</p>
        </div>
      </div>

      {/* Сообщения */}
      <div style={styles.messages}>
        {messages.map(m => (
          <div key={m.id} style={styles.bubble(m.role === 'user')}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={styles.typing}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                ...styles.dot,
                animation: `pulse 1.2s ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Быстрые действия */}
      {messages.length <= 1 && (
        <div style={styles.quickActions}>
          {QUICK.map(q => (
            <button key={q} style={styles.chip} onClick={() => send(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Ввод */}
      <div style={styles.inputArea}>
        <textarea
          ref={textareaRef}
          style={styles.input}
          placeholder="Напиши что купить..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          rows={1}
        />
        <button
          style={styles.sendBtn(!input.trim() || loading)}
          onClick={() => send()}
          disabled={!input.trim() || loading}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1); }
        }
        * { box-sizing: border-box; }
        textarea::placeholder { color: #475569; }
        ::-webkit-scrollbar { width: 0; }
      `}</style>
    </div>
  );
}
