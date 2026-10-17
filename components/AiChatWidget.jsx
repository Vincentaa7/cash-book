'use client'
// components/AiChatWidget.jsx - Balon chat melayang AI Asisten Keuangan

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Send, Bot, AlertCircle } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'

// Helper memformat teks inline: mengubah **tebal** menjadi <strong>, menghapus simbol * liar, dan mengunci nominal Rp agar tidak terpotong baris
function renderInlineText(text = '') {
  if (!text) return null
  const cleaned = String(text)
    .replace(/\*{3,}/g, '**')
    .replace(/`/g, '')

  // Pisahkan bagian **bold** dan nominal Rp 123.456
  const tokenRegex = /(\*\*[^*]+\*\*|Rp\s?[\d.,]+(?:\s?(?:juta|ribu|miliar|jt|rb))?)/gi
  const parts = cleaned.split(tokenRegex)

  return parts.map((part, i) => {
    if (!part) return null
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      const inner = part.slice(2, -2).replace(/\*/g, '').trim()
      if (/^Rp\s?[\d.,]+/i.test(inner)) {
        return (
          <strong key={i} className="ai-currency" style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
            {inner.replace(/\s+/g, '\u00A0')}
          </strong>
        )
      }
      return <strong key={i} className="ai-bold" style={{ fontWeight: 700 }}>{inner}</strong>
    }
    if (/^Rp\s?[\d.,]+/i.test(part)) {
      return (
        <span key={i} className="ai-currency" style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
          {part.replace(/\s+/g, '\u00A0')}
        </span>
      )
    }
    return part.replace(/\*/g, '')
  })
}

// Helper merapikan seluruh isi pesan AI menjadi paragraf & daftar poin yang terstruktur rapi
function renderFormattedMessage(content = '') {
  if (!content) return null
  const lines = String(content)
    .replace(/\r\n/g, '\n')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-') // Normalisasi strip Unicode dari gpt-oss-120b
    .split('\n')

  const elements = []
  let listItems = []

  const flushList = (keyPrefix) => {
    if (listItems.length > 0) {
      elements.push(
        <div
          key={`list-${keyPrefix}`}
          className="ai-list-group"
          style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '2px 0' }}
        >
          {listItems}
        </div>
      )
      listItems = []
    }
  }

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim()
    if (!line) {
      flushList(idx)
      return
    }

    // Abaikan baris yang hanya berisi simbol pemisah --- atau ===
    if (/^[-=*_]{3,}$/.test(line)) {
      return
    }

    // Bersihkan heading markdown ### jika masih ada
    const cleanLine = line.replace(/^#{1,6}\s+/, '')

    // Cek apakah baris adalah item daftar bullet (- , * , • ) atau nomor (1. )
    const bulletMatch = cleanLine.match(/^(?:[-*•]|\d+\.)\s+(.*)$/)
    if (bulletMatch) {
      const itemText = bulletMatch[1].replace(/\*\*/g, '').trim()
      // Cek apakah formatnya "Kategori: Rp xxx" agar bisa ditata rapi sebagai kartu
      const kvMatch = itemText.match(/^([^:]{2,45}):\s*(Rp\s?[\d.,]+.*)$/i)
      if (kvMatch) {
        const labelClean = kvMatch[1].replace(/\*/g, '').trim()
        const valueClean = kvMatch[2].replace(/\*/g, '').trim()
        listItems.push(
          <div
            key={`item-${idx}`}
            className="ai-list-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'rgba(148, 163, 184, 0.08)',
              fontSize: '0.8rem',
              lineHeight: 1.35
            }}
          >
            <span className="ai-list-label" style={{ fontWeight: 500 }}>{renderInlineText(labelClean)}</span>
            <span className="ai-list-value" style={{ whiteSpace: 'nowrap', fontWeight: 700, flexShrink: 0 }}>
              {renderInlineText(valueClean)}
            </span>
          </div>
        )
      } else {
        listItems.push(
          <div
            key={`item-${idx}`}
            className="ai-list-item"
            style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', lineHeight: 1.45 }}
          >
            <span className="ai-list-bullet" style={{ color: 'var(--color-primary-500)', fontWeight: 700, flexShrink: 0 }}>•</span>
            <span className="ai-list-text" style={{ flex: 1 }}>{renderInlineText(itemText)}</span>
          </div>
        )
      }
    } else {
      flushList(idx)
      elements.push(
        <p key={`p-${idx}`} className="ai-paragraph" style={{ margin: 0, lineHeight: 1.55 }}>
          {renderInlineText(cleanLine)}
        </p>
      )
    }
  })

  flushList('end')
  return (
    <div className="ai-formatted-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {elements}
    </div>
  )
}

export default function AiChatWidget() {
  const { t } = useLanguage()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [activeModel, setActiveModel] = useState('Multi-Model AI (Groq)')
  
  const messagesEndRef = useRef(null)

  // Inisialisasi percakapan pertama kali
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: t('ai_welcome') || 'Halo! Saya asisten keuangan keluarga Anda. Ada yang bisa saya bantu analisis hari ini?'
        }
      ])
    }
  }, [t, messages.length])

  // Scroll otomatis ke bawah saat ada pesan baru
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading])

  // Kirim pesan
  async function handleSubmit(e) {
    if (e) e.preventDefault()
    if (!inputValue.trim() || isLoading) return

    const userMessage = inputValue.trim()
    setInputValue('')
    setErrorMsg('')
    
    // Tambah pesan user ke list
    const newMessages = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)
    setIsLoading(true)

    try {
      // Hanya kirim riwayat pesan (kecuali pesan pembuka yang hanya di UI client-side)
      const apiPayload = newMessages.slice(1).map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages: apiPayload })
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.error === 'api_key_missing') {
          setErrorMsg(t('ai_error_key') || 'API Key Groq belum diatur di server.')
        } else {
          setErrorMsg(data.error || t('ai_error_general') || 'Terjadi kesalahan sistem.')
        }
        setIsLoading(false)
        return
      }

      if (data.modelUsed) {
        setActiveModel(`${data.modelUsed.split('/').pop()} (Groq)`)
      }

      // Tambahkan jawaban bot ke list
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])

      // Jika AI baru saja menambahkan transaksi ke database, refresh halaman agar tabel/dashboard terupdate
      if (data.txCreated) {
        router.refresh()
      }
    } catch (err) {
      console.error(err)
      setErrorMsg(t('ai_error_general') || 'Gagal memproses pertanyaan Anda.')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle ketika chip saran diklik
  function handleSuggestClick(suggestionText) {
    setInputValue(suggestionText)
    // Gunakan setTimeout kecil agar state input terupdate sebelum disubmit
    setTimeout(() => {
      const inputEl = document.getElementById('ai-chat-input')
      if (inputEl) {
        inputEl.focus()
      }
    }, 50)
  }

  // Sugesti pertanyaan default
  const suggestions = [
    t('ai_suggest_1') || 'Berapa total belanja saya bulan ini?',
    t('ai_suggest_2') || 'Di kategori apa pengeluaran terbanyak?',
    t('ai_suggest_3') || 'Analisis anggaran kas keluarga saya'
  ]

  return (
    <div className="ai-chat-widget">
      {/* Tombol Balon Melayang */}
      {!isOpen && (
        <button 
          className="ai-chat-bubble-btn"
          onClick={() => setIsOpen(true)}
          title={t('ai_assistant') || 'Asisten AI Keuangan'}
          aria-label="Buka Chat AI Asisten"
        >
          <Bot size={24} />
          <span className="pulse-ring"></span>
        </button>
      )}

      {/* Jendela Pop-up Chat */}
      {isOpen && (
        <div className="ai-chat-window fade-in-up">
          {/* Header */}
          <div className="ai-chat-header">
            <div className="ai-chat-title-container">
              <div className="ai-chat-header-icon">🤖</div>
              <div>
                <div className="ai-chat-header-name">{t('ai_assistant') || 'Asisten AI Keuangan'}</div>
                <div className="ai-chat-header-status">
                  <span className="status-dot"></span>
                  {activeModel}
                </div>
              </div>
            </div>
            <button 
              className="ai-chat-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Tutup Chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Isi Pesan (Chat Box) */}
          <div className="ai-chat-messages">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`ai-message-row ${msg.role === 'user' ? 'user' : 'assistant'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="ai-message-avatar">🤖</div>
                )}
                <div className="ai-message-bubble">
                  {msg.role === 'assistant' ? renderFormattedMessage(msg.content) : msg.content}
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="ai-message-row assistant">
                <div className="ai-message-avatar">🤖</div>
                <div className="ai-message-bubble loading">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="ai-error-banner">
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          {!isLoading && messages.length <= 2 && (
            <div className="ai-chat-suggestions">
              {suggestions.map((sug, i) => (
                <button 
                  key={i} 
                  className="ai-suggest-chip"
                  onClick={() => handleSuggestClick(sug)}
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          {/* Input Form */}
          <form className="ai-chat-input-form" onSubmit={handleSubmit}>
            <input
              id="ai-chat-input"
              type="text"
              className="ai-chat-input-field"
              placeholder={t('ai_placeholder') || 'Tanyakan tentang keuangan Anda...'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
              autoComplete="off"
            />
            <button 
              type="submit" 
              className="ai-chat-send-btn" 
              disabled={isLoading || !inputValue.trim()}
              title="Kirim"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
