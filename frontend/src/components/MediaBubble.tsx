import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MediaType =
    | 'image'
    | 'audio'
    | 'video'
    | 'document'
    | 'sticker'
    | 'location'
    | 'contact';

export type MediaMeta = {
    type: MediaType;
    // shared
    mimeType?: string;
    caption?: string;
    // audio / video
    duration?: number;
    ptt?: boolean;
    // document
    filename?: string;
    // sticker
    animated?: boolean;
    // location
    lat?: number;
    lon?: number;
    address?: string;
    // contact
    displayName?: string;
    vcard?: string;
    // transcription (áudio → Gemini)
    transcription?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDur(s: number) {
    const t = Math.floor(s);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

// Mime → font-awesome-ish icon
function docIcon(mime = '') {
    if (mime.includes('pdf'))   return '📕';
    if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return '📊';
    if (mime.includes('word')  || mime.includes('document')) return '📝';
    if (mime.includes('zip')   || mime.includes('rar') || mime.includes('tar')) return '📦';
    if (mime.includes('audio')) return '🎵';
    if (mime.includes('video')) return '🎬';
    return '📄';
}

// ─── Lazy loader hook ─────────────────────────────────────────────────────────

type LoadState = 'idle' | 'loading' | 'loaded' | 'error' | 'unavailable';

function base64ToBlob(b64: string, mime: string): Blob {
    const binary = atob(b64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

function useMediaLoad(messageId: string, autoLoad = false) {
    const [state, setState]   = useState<LoadState>('idle');
    const [src, setSrc]       = useState<string | null>(null);
    const [mime, setMime]     = useState<string>('');
    const blobUrlRef          = useRef<string | null>(null);

    useEffect(() => {
        if (autoLoad) load();
        return () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); };
    }, []);

    function retry() { setState('idle'); }

    async function load() {
        if (state === 'loading' || state === 'loaded') return;
        setState('loading');
        try {
            const res: { base64: string; mimeType: string } =
                await axios.get(`/api/messages/${messageId}/media`).then(r => r.data);
            const resolvedMime = res.mimeType || 'application/octet-stream';
            const blob = base64ToBlob(res.base64, resolvedMime);
            const url  = URL.createObjectURL(blob);
            blobUrlRef.current = url;
            setSrc(url);
            setMime(resolvedMime);
            setState('loaded');
        } catch (e: any) {
            const status = e?.response?.status;
            // 404 = no messageData (operator-sent before fix) — show graceful placeholder
            if (status === 404 || status === 400) {
                setState('unavailable');
            } else {
                console.error(`[MediaBubble] load failed ${messageId}:`, e);
                setState('error');
            }
        }
    }

    return { state, src, mime, load, retry };
}

// ─── Placeholder ──────────────────────────────────────────────────────────────

function Placeholder({
    icon, label, width = 240, height = 150, onClick,
}: { icon: string; label?: string; width?: number; height?: number; onClick?: () => void }) {
    return (
        <div
            onClick={onClick}
            style={{
                width, height, borderRadius: 12,
                background: 'var(--paper-3)',
                border: '1px solid var(--line)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 8, cursor: onClick ? 'pointer' : 'default',
                userSelect: 'none',
            }}
        >
            <span style={{ fontSize: 32 }}>{icon}</span>
            {label && <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{label}</span>}
        </div>
    );
}

function Spinner() {
    return (
        <div style={{
            width: 240, height: 150, borderRadius: 12,
            background: 'var(--paper-3)', border: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <span style={{ fontSize: 11, color: 'var(--ink-4)', animation: 'pulse 1.2s ease-in-out infinite' }}>
                Carregando…
            </span>
        </div>
    );
}

// ─── Individual media renderers ───────────────────────────────────────────────

function ImageMedia({ messageId, media, textColor }: { messageId: string; media: MediaMeta; textColor: string }) {
    const { state, src, load, retry } = useMediaLoad(messageId);
    const [lightbox, setLightbox] = useState(false);
    const placeholderRef = useRef<HTMLDivElement>(null);

    // Auto-load when placeholder enters viewport
    useEffect(() => {
        if (state !== 'idle') return;
        const el = placeholderRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { load(); observer.disconnect(); } },
            { threshold: 0.1 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [state]);

    return (
        <>
            {/* Lightbox */}
            {lightbox && src && (
                <div
                    onClick={() => setLightbox(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 300,
                        background: 'rgba(0,0,0,0.9)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'zoom-out',
                    }}
                >
                    <img
                        src={src}
                        alt={media.caption || 'imagem'}
                        style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 10, objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
                    />
                    {media.caption && (
                        <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 13, textShadow: '0 1px 4px rgba(0,0,0,0.8)', padding: '0 32px' }}>
                            {media.caption}
                        </div>
                    )}
                </div>
            )}

            {state === 'idle' && (
                <div ref={placeholderRef}>
                    <Placeholder icon="🖼" label="Carregando…" />
                </div>
            )}
            {state === 'loading'     && <Spinner />}
            {state === 'loaded'      && src && (
                <img
                    src={src}
                    alt={media.caption || 'imagem'}
                    onClick={() => setLightbox(true)}
                    style={{ maxWidth: 300, maxHeight: 320, borderRadius: 12, display: 'block', cursor: 'zoom-in', objectFit: 'cover' }}
                />
            )}
            {state === 'unavailable' && <Placeholder icon="🖼" label="Imagem enviada" width={180} height={80} />}
            {state === 'error'       && <ErrorMsg text="Falha ao carregar imagem" onRetry={retry} />}
            {media.caption           && <Caption text={media.caption} color={textColor} />}
        </>
    );
}

const SPEEDS = [1, 1.5, 2, 2.5, 3];

function CustomAudioPlayer({ src, media, textColor, isAgent }: { src: string; mime?: string; media: MediaMeta; textColor: string; isAgent: boolean }) {
    const audioRef    = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress]   = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration]   = useState(media.duration || 0);
    const [speedIdx, setSpeedIdx]   = useState(0); // index into SPEEDS

    const speed = SPEEDS[speedIdx];

    useEffect(() => {
        // Blob URL carries MIME type — load() triggers browser resource selection
        if (audioRef.current) {
            audioRef.current.load();
        }
    }, [src]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(e => console.error('[Audio] play() failed:', e));
        }
    };

    const cycleSpeed = () => {
        const next = (speedIdx + 1) % SPEEDS.length;
        setSpeedIdx(next);
        if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
    };

    const handleTimeUpdate = () => {
        if (!audioRef.current) return;
        setCurrentTime(audioRef.current.currentTime);
        if (audioRef.current.duration) {
            setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0);
        }
    };

    const handleLoadedMetadata = () => {
        if (!audioRef.current) return;
        if (audioRef.current.duration && audioRef.current.duration !== Infinity) {
            setDuration(audioRef.current.duration);
        }
        // Apply current speed when audio loads
        audioRef.current.playbackRate = speed;
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
        if (audioRef.current) audioRef.current.currentTime = 0;
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!audioRef.current) return;
        const newTime = (Number(e.target.value) / 100) * (duration || 1);
        audioRef.current.currentTime = newTime;
        setProgress(Number(e.target.value));
    };

    const trackColor  = isAgent ? 'rgba(255,255,255,0.2)' : 'var(--line-2)';
    const thumbColor  = isAgent ? '#fff' : 'var(--accent)';
    const btnBg       = isAgent ? 'rgba(255,255,255,0.15)' : 'var(--accent-soft)';
    const btnColor    = isAgent ? '#fff' : 'var(--accent)';
    const speedActive = speedIdx > 0;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 260, padding: '4px 0' }}>
            {/* Blob URL already carries MIME — src direct, no <source> child needed */}
            <audio
                ref={audioRef}
                src={src}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onError={e => console.error('[Audio] decode error:', e)}
                style={{ display: 'none' }}
            />

            {/* Play / Pause */}
            <button
                onClick={togglePlay}
                style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: btnBg, color: btnColor,
                    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0,
                    transition: 'transform 0.15s, opacity 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.opacity = '0.8'}
                onMouseOut={e  => e.currentTarget.style.opacity = '1'}
            >
                {isPlaying ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 3 }}>
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                )}
            </button>

            {/* Track + time */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ position: 'relative', height: 16, display: 'flex', alignItems: 'center' }}>
                    {/* Track background */}
                    <div style={{ position: 'absolute', width: '100%', height: 4, background: trackColor, borderRadius: 2 }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: thumbColor, borderRadius: 2, transition: 'width 0.1s' }} />
                    </div>
                    {/* Thumb knob */}
                    <div style={{
                        position: 'absolute',
                        left: `clamp(0px, calc(${progress}% - 6px), calc(100% - 12px))`,
                        width: 12, height: 12, background: thumbColor,
                        borderRadius: '50%', pointerEvents: 'none',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }} />
                    {/* Invisible range input on top for interaction */}
                    <input
                        type="range" min="0" max="100" value={progress}
                        onChange={handleSeek}
                        style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'pointer', margin: 0 }}
                    />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: textColor, opacity: 0.65, fontFamily: "'Geist Mono', monospace", fontWeight: 500 }}>
                    <span>{fmtDur(currentTime)}</span>
                    <span>{fmtDur(duration || 0)}</span>
                </div>
            </div>

            {/* Speed selector */}
            <button
                onClick={cycleSpeed}
                title="Velocidade de reprodução"
                style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: speedActive ? btnBg : (isAgent ? 'rgba(255,255,255,0.08)' : 'var(--paper-3)'),
                    border: `1px solid ${speedActive ? thumbColor : trackColor}`,
                    color: speedActive ? btnColor : textColor,
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: speed >= 2.5 ? 9 : 10,
                    fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                    opacity: speedActive ? 1 : 0.6,
                }}
                onMouseOver={e => e.currentTarget.style.opacity = '1'}
                onMouseOut={e  => e.currentTarget.style.opacity = speedActive ? '1' : '0.6'}
            >
                {speed}×
            </button>
        </div>
    );
}

function AudioMedia({ messageId, media, textColor, isAgent }: { messageId: string; media: MediaMeta; textColor: string; isAgent: boolean }) {
    const { state, src, mime, load, retry } = useMediaLoad(messageId);

    const trackColor = isAgent ? 'rgba(255,255,255,0.2)' : 'var(--line-2)';
    const btnBg = isAgent ? 'rgba(255,255,255,0.15)' : 'var(--accent-soft)';
    const btnColor = isAgent ? '#fff' : 'var(--accent)';
    const iconColor = isAgent ? 'rgba(255,255,255,0.7)' : 'var(--ink-3)';

    return (
        <div style={{ minWidth: 260 }}>
            {state === 'idle' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
                    <button 
                        onClick={load}
                        style={{ 
                            width: 44, height: 44, borderRadius: '50%', 
                            background: btnBg, color: btnColor,
                            border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', flexShrink: 0, transition: 'transform 0.2s',
                        }}
                        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
                    </button>
                    
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ width: '100%', height: 4, background: trackColor, borderRadius: 2 }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: textColor, opacity: 0.7, fontFamily: "'Geist Mono', monospace", fontWeight: 500 }}>
                            <span>0:00</span>
                            <span>{fmtDur(media.duration || 0)}</span>
                        </div>
                    </div>
                    
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: isAgent ? 'rgba(255,255,255,0.1)' : 'var(--paper-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${trackColor}` }}>
                        {media.ptt ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                        )}
                    </div>
                </div>
            )}
            
            {state === 'loading' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: btnBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {/* CSS spinner — animateTransform unreliable in React */}
                        <div style={{
                            width: 20, height: 20, borderRadius: '50%',
                            border: `3px solid ${trackColor}`,
                            borderTopColor: btnColor,
                            animation: 'audio-spin 0.8s linear infinite',
                        }} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, opacity: 0.5 }}>
                        <div style={{ width: '100%', height: 4, background: trackColor, borderRadius: 2 }} />
                        <span style={{ fontSize: 11, color: textColor, fontFamily: "'Geist Mono', monospace" }}>Carregando…</span>
                    </div>
                </div>
            )}
            
            {state === 'loaded'      && src && (
                <CustomAudioPlayer src={src} mime={mime} media={media} textColor={textColor} isAgent={isAgent} />
            )}
            {state === 'unavailable' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: textColor, opacity: 0.6 }}>
                    <span>{media.ptt ? '🎤' : '🎵'}</span>
                    <span>Áudio enviado{media.duration ? ` · ${fmtDur(media.duration)}` : ''}</span>
                </div>
            )}
            {state === 'error' && <ErrorMsg text="Falha ao carregar áudio" onRetry={retry} />}

            {/* Transcrição gerada pelo Gemini */}
            {media.transcription && (
                <div style={{
                    marginTop: 8, padding: '6px 10px',
                    background: 'var(--paper-2)', borderRadius: 6,
                    border: '1px solid var(--line)', maxWidth: 280,
                }}>
                    <span style={{
                        fontFamily: "'Geist Mono', monospace", fontSize: 9,
                        color: 'var(--ink-5)', textTransform: 'uppercase',
                        letterSpacing: 0.5, display: 'block', marginBottom: 3,
                    }}>Transcrição</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', lineHeight: 1.5 }}>
                        "{media.transcription}"
                    </span>
                </div>
            )}
        </div>
    );
}

function VideoMedia({ messageId, media, textColor }: { messageId: string; media: MediaMeta; textColor: string }) {
    const { state, src, load, retry } = useMediaLoad(messageId);

    return (
        <>
            {state === 'idle'        && <Placeholder icon="▶" label={`Clique para carregar${media.duration ? ` · ${fmtDur(media.duration)}` : ''}`} onClick={load} />}
            {state === 'loading'     && <Spinner />}
            {state === 'loaded'      && src && <video controls src={src} style={{ maxWidth: 300, borderRadius: 12, display: 'block' }} />}
            {state === 'unavailable' && <Placeholder icon="▶" label="Vídeo enviado" width={180} height={80} />}
            {state === 'error'       && <ErrorMsg text="Falha ao carregar vídeo" onRetry={retry} />}
            {media.caption           && <Caption text={media.caption} color={textColor} />}
        </>
    );
}

function DocumentMedia({ messageId, media, textColor, isAgent }: { messageId: string; media: MediaMeta; textColor: string; isAgent: boolean }) {
    const { state, src, load, retry } = useMediaLoad(messageId);
    const border = `1px solid ${isAgent ? 'rgba(255,255,255,0.2)' : 'var(--line-2)'}`;
    const icon = docIcon(media.mimeType);

    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 200 }}>
            <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'var(--paper-3)', border: '1px solid var(--line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, flexShrink: 0,
            }}>{icon}</div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: textColor, fontWeight: 600, lineHeight: 1.3, wordBreak: 'break-word' }}>
                    {media.filename ?? 'Documento'}
                </div>
                {media.mimeType && (
                    <div style={{ fontSize: 10, color: textColor, opacity: 0.5, fontFamily: "'Geist Mono', monospace", marginTop: 1 }}>
                        {media.mimeType.split('/')[1]?.toUpperCase() ?? media.mimeType}
                    </div>
                )}
                <div style={{ marginTop: 8 }}>
                    {state === 'idle'        && <button onClick={load} style={{ fontSize: 11, color: textColor, background: 'none', border, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>⬇ Baixar</button>}
                    {state === 'loading'     && <span style={{ fontSize: 11, color: textColor, opacity: 0.6 }}>Carregando…</span>}
                    {state === 'loaded'      && src && (
                        <a href={src} download={media.filename ?? 'arquivo'} style={{ fontSize: 11, color: 'var(--accent-ink)', textDecoration: 'underline' }}>
                            ⬇ Salvar arquivo
                        </a>
                    )}
                    {state === 'unavailable' && <span style={{ fontSize: 11, color: textColor, opacity: 0.5 }}>Arquivo enviado</span>}
                    {state === 'error'       && <ErrorMsg text="Falha ao baixar" onRetry={retry} />}
                </div>
                {media.caption && <Caption text={media.caption} color={textColor} />}
            </div>
        </div>
    );
}

function StickerMedia({ messageId }: { messageId: string }) {
    const { state, src } = useMediaLoad(messageId, true); // auto-load stickers

    return (
        <div style={{ lineHeight: 0 }}>
            {state === 'idle'    && <div style={{ width: 120, height: 120 }} />}
            {state === 'loading' && <div style={{ width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 11, color: 'var(--ink-5)' }}>…</span></div>}
            {state === 'loaded'  && src && (
                <img src={src} alt="sticker" style={{ width: 120, height: 120, objectFit: 'contain', borderRadius: 4 }} />
            )}
            {state === 'error'   && <span style={{ fontSize: 24 }}>🎭</span>}
        </div>
    );
}

function LocationMedia({ media }: { media: MediaMeta }) {
    const { lat, lon, address } = media;
    const mapsUrl = lat && lon ? `https://www.google.com/maps?q=${lat},${lon}` : null;

    return (
        <a
            href={mapsUrl ?? '#'}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', minWidth: 200 }}
        >
            <div style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: 'var(--accent-soft)', border: '1px solid var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>📍</div>
            <div>
                <div style={{ fontSize: 13, color: 'var(--accent-ink)', fontWeight: 600 }}>
                    {address ?? 'Localização'}
                </div>
                {lat && lon && (
                    <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: 'var(--ink-4)', marginTop: 2 }}>
                        {lat.toFixed(5)}, {lon.toFixed(5)}
                    </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 3 }}>
                    Abrir no Maps →
                </div>
            </div>
        </a>
    );
}

function ContactMedia({ media }: { media: MediaMeta }) {
    function downloadVcard() {
        if (!media.vcard) return;
        const blob = new Blob([media.vcard], { type: 'text/vcard' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `${media.displayName ?? 'contato'}.vcf`;
        a.click(); URL.revokeObjectURL(url);
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: 'var(--paper-3)', border: '1px solid var(--line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Fraunces', serif", fontSize: 18, color: 'var(--ink-2)',
            }}>
                {(media.displayName ?? 'C')[0].toUpperCase()}
            </div>
            <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>
                    {media.displayName ?? 'Contato'}
                </div>
                {media.vcard && (
                    <button
                        onClick={downloadVcard}
                        style={{ fontSize: 11, color: 'var(--accent-ink)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4, fontFamily: 'inherit', textDecoration: 'underline' }}
                    >
                        ⬇ Salvar contato (.vcf)
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── Micro helpers ────────────────────────────────────────────────────────────

function ErrorMsg({ text, onRetry }: { text: string; onRetry?: () => void }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--danger)' }}>{text}</span>
            {onRetry && (
                <button onClick={onRetry} style={{ fontSize: 10, color: 'var(--accent-ink)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontFamily: 'inherit' }}>
                    Tentar novamente
                </button>
            )}
        </div>
    );
}

function Caption({ text, color }: { text: string; color: string }) {
    return <div style={{ fontSize: 12.5, color, marginTop: 6, lineHeight: 1.4 }}>{text}</div>;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function MediaBubble({
    messageId,
    media,
    isAgent,
}: {
    messageId: string;
    media: MediaMeta;
    isAgent: boolean;
}) {
    const textColor = isAgent ? 'var(--bubble-agent-color)' : 'var(--ink-1)';

    return (
        <>
            <style>{`@keyframes audio-spin { to { transform: rotate(360deg); } }`}</style>
            {renderMedia()}
        </>
    );

    function renderMedia() {

    switch (media.type) {
        case 'image':
            return <ImageMedia    messageId={messageId} media={media} textColor={textColor} />;
        case 'audio':
            return <AudioMedia    messageId={messageId} media={media} textColor={textColor} isAgent={isAgent} />;
        case 'video':
            return <VideoMedia    messageId={messageId} media={media} textColor={textColor} />;
        case 'document':
            return <DocumentMedia messageId={messageId} media={media} textColor={textColor} isAgent={isAgent} />;
        case 'sticker':
            return <StickerMedia  messageId={messageId} />;
        case 'location':
            return <LocationMedia media={media} />;
        case 'contact':
            return <ContactMedia  media={media} />;
        default:
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-4)' }}>
                    <span>📎</span>
                    <span>Mídia não suportada ({(media as MediaMeta).type})</span>
                </div>
            );
    }
  }
}
