import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { uploadDoc, listDocs, deleteDoc, sendChat } from '../api/client'

const TABS = ['Results', 'Q&A Chat', 'Raw JSON']
const fileIcon = t => ({ pdf: '📄', image: '🖼️', text: '📝' }[t] || '📁')
const statusColor = s => ({ DONE: '#4ade80', PROCESSING: '#fbbf24', ERROR: '#f87171', PENDING: '#94a3b8' }[s])

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, color: '#8a87a0', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ background: '#16161a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 12 }}>{children}</div>
    </div>
  )
}

export default function Dashboard() {
  const [docs, setDocs]                   = useState([])
  const [activeDoc, setActiveDoc]         = useState(null)
  const [tab, setTab]                     = useState('Results')
  const [uploading, setUploading]         = useState(false)
  const [progress, setProgress]           = useState(0)
  const [opts, setOpts]                   = useState({ summary: true, entities: true, keyinfo: true, sentiment: true, tables: false })
  const [customPrompt, setCustomPrompt]   = useState('')
  const [chatInput, setChatInput]         = useState('')
  const [chatHistory, setChatHistory]     = useState([])
  const [sessionId, setSessionId]         = useState(null)
  const [chatLoading, setChatLoading]     = useState(false)

  useEffect(() => { listDocs().then(setDocs).catch(console.error) }, [])

  const onDrop = useCallback(async ([file]) => {
    if (!file) return
    setUploading(true)
    setProgress(0)
    try {
      const result = await uploadDoc(file, { ...opts, customPrompt }, p => setProgress(p))
      setDocs(d => [result, ...d])
      setActiveDoc(result)
      setTab('Results')
      setChatHistory([])
      setSessionId(null)
    } catch (e) {
      alert(e.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }, [opts, customPrompt])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': [], 'image/png': [], 'image/jpeg': [],
      'image/webp': [], 'text/plain': [], 'text/csv': [], 'text/markdown': [],
    },
    maxFiles: 1,
    disabled: uploading,
  })

  const handleChat = async () => {
    if (!chatInput.trim() || !activeDoc || chatLoading) return
    const msg = chatInput.trim()
    setChatInput('')
    setChatLoading(true)
    setChatHistory(h => [...h, { role: 'user', content: msg }])
    try {
      const res = await sendChat(activeDoc.id, msg, sessionId)
      setSessionId(res.sessionId)
      setChatHistory(res.history)
    } catch (e) {
      setChatHistory(h => [...h, { role: 'assistant', content: 'Error: ' + (e.response?.data?.error || e.message) }])
    } finally {
      setChatLoading(false)
    }
  }

  const ext = activeDoc?.extraction

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', height: '100vh', background: '#0f0f12', color: '#e8e6f0', fontFamily: 'monospace', fontSize: 13 }}>

      {/* Sidebar */}
      <div style={{ borderRight: '1px solid rgba(255,255,255,0.08)', padding: 16, overflowY: 'auto', background: '#16161a' }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: '#a89cf5' }}>⬡ DocIQ</div>
        <div style={{ fontSize: 10, color: '#8a87a0', letterSpacing: '0.1em', marginBottom: 8 }}>RECENT DOCS</div>
        {docs.map(d => (
          <div key={d.id}
            onClick={() => { setActiveDoc(d); setChatHistory([]); setSessionId(null) }}
            style={{ padding: '8px 10px', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
              background: activeDoc?.id === d.id ? 'rgba(124,110,247,0.12)' : 'transparent',
              border: `1px solid ${activeDoc?.id === d.id ? 'rgba(124,110,247,0.3)' : 'transparent'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>{fileIcon(d.fileType)}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontSize: 11 }}>{d.originalName}</span>
            </div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor(d.status), marginTop: 4 }} />
          </div>
        ))}
      </div>

      {/* Main */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100vh' }}>

        {/* Left: Upload */}
        <div style={{ borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#16161a', fontSize: 11, color: '#8a87a0', letterSpacing: '0.08em' }}>INPUT</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

            <div {...getRootProps()} style={{
              border: `2px dashed ${isDragActive ? '#7c6ef7' : 'rgba(255,255,255,0.14)'}`,
              borderRadius: 16, padding: '36px 24px', textAlign: 'center', cursor: 'pointer',
              background: isDragActive ? 'rgba(124,110,247,0.08)' : '#16161a', transition: 'all 0.2s' }}>
              <input {...getInputProps()} />
              <div style={{ fontSize: 32, marginBottom: 10 }}>{uploading ? '⏳' : '📂'}</div>
              <div style={{ fontSize: 14, color: '#e8e6f0', marginBottom: 6 }}>
                {uploading ? `Extracting… ${progress}%` : 'Drop your document here'}
              </div>
              <div style={{ fontSize: 11, color: '#8a87a0' }}>PDF · PNG · JPG · WEBP · TXT · CSV</div>
              {uploading && (
                <div style={{ height: 3, background: '#26262f', borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: '#7c6ef7', transition: 'width 0.3s' }} />
                </div>
              )}
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 10, color: '#8a87a0', letterSpacing: '0.1em', marginBottom: 8 }}>EXTRACTION OPTIONS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[['summary','📋 Summary'],['entities','🏷 Entities'],['keyinfo','🔑 Key Info'],['sentiment','🎯 Sentiment'],['tables','⊞ Tables']].map(([k, label]) => (
                  <div key={k} onClick={() => setOpts(o => ({ ...o, [k]: !o[k] }))}
                    style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                      background: opts[k] ? 'rgba(124,110,247,0.12)' : '#16161a',
                      border: `1px solid ${opts[k] ? 'rgba(124,110,247,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                    <span style={{ fontSize: 14 }}>{label.split(' ')[0]}</span>
                    <span style={{ fontSize: 11, color: opts[k] ? '#a89cf5' : '#8a87a0' }}>{label.split(' ')[1]}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: opts[k] ? '#a89cf5' : 'transparent' }}>✓</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, color: '#8a87a0', letterSpacing: '0.1em', marginBottom: 8 }}>CUSTOM INSTRUCTIONS</div>
              <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
                placeholder="e.g. Extract all invoice numbers and vendor names…"
                style={{ width: '100%', background: '#16161a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                  padding: '10px 12px', color: '#e8e6f0', fontFamily: 'monospace', fontSize: 12, resize: 'vertical', minHeight: 72, outline: 'none' }} />
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#16161a' }}>
            {TABS.map(t => (
              <div key={t} onClick={() => setTab(t)}
                style={{ padding: '10px 16px', fontSize: 11, cursor: 'pointer', letterSpacing: '0.04em',
                  color: tab === t ? '#a89cf5' : '#8a87a0',
                  borderBottom: `2px solid ${tab === t ? '#7c6ef7' : 'transparent'}` }}>
                {t}
              </div>
            ))}
          </div>

          {/* Results tab */}
          {tab === 'Results' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {!ext ? (
                <div style={{ textAlign: 'center', color: '#8a87a0', marginTop: 60 }}>
                  <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>⬡</div>
                  <div>Upload a document to see results</div>
                </div>
              ) : (
                <>
                  <div style={{ background: '#16161a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 15, color: '#e8e6f0', marginBottom: 4, fontStyle: 'italic' }}>{ext.documentTitle || 'Untitled'}</div>
                    <div style={{ fontSize: 11, color: '#8a87a0' }}>{ext.documentType} · {ext.language}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      {[['Words', ext.wordCount], ['Pages', ext.pageCount ?? '—'], ['Confidence', ext.confidence ? `${Math.round(ext.confidence * 100)}%` : '—']].map(([l, v]) => (
                        <div key={l} style={{ flex: 1, background: '#26262f', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ fontSize: 16, fontWeight: 500, color: '#a89cf5' }}>{v ?? '—'}</div>
                          <div style={{ fontSize: 10, color: '#8a87a0', marginTop: 2 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {ext.summaryBrief && (
                    <Section label="Summary">
                      <p style={{ fontSize: 12, color: '#8a87a0', lineHeight: 1.7, margin: 0 }}>{ext.summaryBrief}</p>
                      {ext.keyPoints?.map((pt, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 6 }}>
                          <span style={{ color: '#a89cf5' }}>◆</span>
                          <span style={{ fontSize: 12, color: '#8a87a0' }}>{pt}</span>
                        </div>
                      ))}
                    </Section>
                  )}

                  {ext.sentiment?.overall && (
                    <Section label="Sentiment">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 20 }}>{ext.sentiment.overall === 'positive' ? '🟢' : ext.sentiment.overall === 'negative' ? '🔴' : '🟡'}</span>
                        <div>
                          <div style={{ color: '#a89cf5', fontSize: 12, textTransform: 'capitalize' }}>{ext.sentiment.overall}</div>
                          <div style={{ fontSize: 11, color: '#8a87a0' }}>{ext.sentiment.tone}</div>
                        </div>
                        <span style={{ marginLeft: 'auto', color: '#a89cf5' }}>{ext.sentiment.score >= 0 ? '+' : ''}{(ext.sentiment.score || 0).toFixed(2)}</span>
                      </div>
                    </Section>
                  )}

                  {ext.keyInformation?.length > 0 && (
                    <Section label="Key Information">
                      {ext.keyInformation.map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12 }}>
                          <span style={{ color: '#8a87a0' }}>{item.field}</span>
                          <span style={{ background: 'rgba(124,110,247,0.12)', color: '#a89cf5', padding: '1px 8px', borderRadius: 4 }}>{item.value}</span>
                        </div>
                      ))}
                    </Section>
                  )}

                  {ext.entities && Object.values(ext.entities).some(v => v?.length) && (
                    <Section label="Entities">
                      {[['persons','👤','#a89cf5'],['organizations','🏢','#2dd4bf'],['locations','📍','#f87171'],['dates','📅','#fbbf24'],['monetary_values','💰','#4ade80']].map(([key, icon, color]) =>
                        ext.entities[key]?.length ? (
                          <div key={key} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 10, color: '#8a87a0', marginBottom: 4 }}>{icon} {key.replace('_', ' ').toUpperCase()}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {ext.entities[key].map((v, i) => (
                                <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `1px solid ${color}40`, color, background: `${color}12` }}>{v}</span>
                              ))}
                            </div>
                          </div>
                        ) : null
                      )}
                    </Section>
                  )}
                </>
              )}
            </div>
          )}

          {/* Chat tab */}
          {tab === 'Q&A Chat' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {chatHistory.length === 0 && (
                  <div style={{ color: '#8a87a0', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
                    {activeDoc ? 'Ask anything about your document…' : 'Upload a document first.'}
                  </div>
                )}
                {chatHistory.map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: m.role === 'user' ? '#26262f' : '#7c6ef7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
                      {m.role === 'user' ? '◯' : '⬡'}
                    </div>
                    <div style={{ background: m.role === 'user' ? 'rgba(124,110,247,0.1)' : '#16161a', border: `1px solid ${m.role === 'user' ? 'rgba(124,110,247,0.25)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, padding: '9px 13px', fontSize: 12, lineHeight: 1.7, color: '#e8e6f0', maxWidth: '85%' }}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: '#7c6ef7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>⬡</div>
                    <div style={{ background: '#16161a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '9px 13px', fontSize: 12, color: '#8a87a0' }}>Thinking…</div>
                  </div>
                )}
              </div>
              <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.08)', background: '#16161a', display: 'flex', gap: 8 }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChat()}
                  placeholder="Ask about the document…"
                  style={{ flex: 1, background: '#26262f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '9px 14px', color: '#e8e6f0', fontFamily: 'monospace', fontSize: 12, outline: 'none' }} />
                <button onClick={handleChat} disabled={chatLoading || !activeDoc}
                  style={{ background: '#7c6ef7', border: 'none', borderRadius: 8, padding: '9px 16px', color: '#fff', cursor: 'pointer', fontFamily: 'monospace', fontSize: 12, opacity: chatLoading || !activeDoc ? 0.5 : 1 }}>
                  Send
                </button>
              </div>
            </div>
          )}

          {/* Raw JSON tab */}
          {tab === 'Raw JSON' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {!ext ? (
                <div style={{ color: '#8a87a0', textAlign: 'center', marginTop: 60 }}>No data yet</div>
              ) : (
                <>
                  <button onClick={() => navigator.clipboard.writeText(JSON.stringify(ext.rawJson, null, 2))}
                    style={{ marginBottom: 12, background: '#26262f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '5px 12px', color: '#e8e6f0', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace' }}>
                    Copy JSON
                  </button>
                  <pre style={{ background: '#16161a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 14, fontSize: 11, lineHeight: 1.8, color: '#4ade80', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {JSON.stringify(ext.rawJson, null, 2)}
                  </pre>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}