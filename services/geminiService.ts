
import { GoogleGenAI, Modality, LiveServerMessage, Blob } from '@google/genai';
import { audioService, encode, decode, decodeAudioData } from './audioService';

class GeminiService {
  private ai: any;
  private sessionPromise: Promise<any> | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private outputNode: GainNode | null = null;
  private stream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private micInputContext: AudioContext | null = null;

  async connect(onMessage: (text: string) => void, onStatus: (status: string) => void) {
    if (!this.ai) {
      this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }

    const outputAudioContext = audioService.getAudioContext();
    if (!outputAudioContext) return;

    this.outputNode = outputAudioContext.createGain();
    
    const bandpass = outputAudioContext.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1500;
    bandpass.Q.value = 1.0;
    
    this.outputNode.connect(bandpass);
    bandpass.connect(outputAudioContext.destination);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            onStatus('CONNECTED');
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              this.nextStartTime = Math.max(this.nextStartTime, outputAudioContext.currentTime);
              const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                outputAudioContext,
                24000,
                1
              );
              const source = outputAudioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(this.outputNode!);
              source.addEventListener('ended', () => {
                this.sources.delete(source);
              });
              source.start(this.nextStartTime);
              this.nextStartTime += audioBuffer.duration;
              this.sources.add(source);
              onStatus('LISTENING');
            }

            if (message.serverContent?.interrupted) {
              this.sources.forEach(s => s.stop());
              this.sources.clear();
              this.nextStartTime = 0;
            }
          },
          onerror: (e: any) => {
            console.error('Gemini Error:', e);
            onStatus('ERROR');
          },
          onclose: () => {
            onStatus('IDLE');
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
          },
          systemInstruction: "You are a radio operator from the 1980s. Keep your responses short, use military radio slang (Roger, Over, Copy that, Out), and sound slightly cryptic. Do not break character."
        }
      });

      this.micInputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const sourceNode = this.micInputContext.createMediaStreamSource(this.stream!);
      this.scriptProcessor = this.micInputContext.createScriptProcessor(4096, 1, 1);
      
      this.scriptProcessor.onaudioprocess = (e) => {
        if ((window as any).isTalking) { 
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmBlob = this.createBlob(inputData);
          this.sessionPromise?.then((session) => {
            session.sendRealtimeInput({ media: pcmBlob });
          });
        }
      };

      sourceNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.micInputContext.destination);

    } catch (err) {
      console.error('Failed to connect to Gemini:', err);
      onStatus('CONNECTION FAILED');
    }
  }

  private createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  }

  disconnect() {
    this.sessionPromise?.then(session => session.close());
    this.sessionPromise = null;
    
    // Stop and cleanup mic stream
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    
    // Disconnect audio nodes
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor.onaudioprocess = null;
    }
    
    if (this.micInputContext) {
      this.micInputContext.close();
      this.micInputContext = null;
    }

    // Stop all pending output sounds
    this.sources.forEach(s => {
      try { s.stop(); } catch(e) {}
    });
    this.sources.clear();
  }
}

export const geminiService = new GeminiService();
