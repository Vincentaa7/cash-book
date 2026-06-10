'use client'
// components/AiChatWidget.jsx - Balon chat melayang AI Asisten Keuangan

import { useState, useEffect, useRef } from 'react'
import { X, Send, Bot, AlertCircle } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'

export default function AiChatWidget() {
  const { t } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  
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

      // Tambahkan jawaban bot ke list
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
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
                  Llama 3.3 (Groq API)
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
                  {msg.content}
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
