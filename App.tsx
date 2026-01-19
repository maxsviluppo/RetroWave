
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Frequency, RadioStatus, User } from './types';
import { audioService } from './services/audioService';
import { geminiService } from './services/geminiService';

const App: React.FC = () => {
  const [frequency, setFrequency] = useState<Frequency>(Frequency.F2);
  const [status, setStatus] = useState<RadioStatus>(RadioStatus.IDLE);
  const [userName, setUserName] = useState('OPERATOR_1');
  const [connectedUsers, setConnectedUsers] = useState<User[]>([
    { id: '1', name: 'BASE_STATION', status: RadioStatus.IDLE },
    { id: '2', name: 'GEMINI_AI', status: RadioStatus.IDLE }
  ]);
  const [isPowerOn, setIsPowerOn] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>('');
  
  const pttActiveRef = useRef(false);

  // Expose talk state to global for service access
  useEffect(() => {
    (window as any).isTalking = status === RadioStatus.TALKING;
  }, [status]);

  const handlePowerToggle = async () => {
    if (!isPowerOn) {
      if (!audioService.getAudioContext()) {
        audioService.init();
      } else {
        await audioService.resume();
      }
      
      audioService.playClick();
      setIsPowerOn(true);
      setStatus(RadioStatus.CONNECTING);
      
      await geminiService.connect(
        (txt) => setLastMessage(txt),
        (s) => {
          if (s === 'CONNECTED') setStatus(RadioStatus.IDLE);
          else if (s === 'LISTENING') setStatus(RadioStatus.LISTENING);
          else if (s === 'ERROR') setStatus(RadioStatus.ERROR);
        }
      );
    } else {
      geminiService.disconnect();
      await audioService.silence();
      setIsPowerOn(false);
      setStatus(RadioStatus.IDLE);
    }
  };

  const startTalking = () => {
    if (!isPowerOn || status === RadioStatus.LISTENING) return;
    audioService.playClick();
    audioService.setStaticVolume(0.08);
    setStatus(RadioStatus.TALKING);
  };

  const stopTalking = () => {
    if (!isPowerOn || status !== RadioStatus.TALKING) return;
    audioService.playClick();
    audioService.setStaticVolume(0.005);
    setStatus(RadioStatus.IDLE);
  };

  const changeFreq = (f: Frequency) => {
    if (!isPowerOn) return;
    audioService.playFreqSwitch();
    setFrequency(f);
  };

  const getBandNumber = (f: Frequency) => {
    switch(f) {
      case Frequency.F1: return "B1";
      case Frequency.F2: return "B2";
      case Frequency.F3: return "B3";
      default: return "--";
    }
  };

  const BatteryIndicator = () => (
    <div className="flex items-center gap-1.5 opacity-80">
      <span className="text-[#00FF66] text-[8px] font-['Press_Start_2P']">98%</span>
      <div className="relative w-6 h-3 border border-[#00FF66] p-[1px] flex items-center">
        <div className="w-1.5 h-full bg-[#00FF66] mr-[1px]"></div>
        <div className="w-1.5 h-full bg-[#00FF66] mr-[1px]"></div>
        <div className="w-1.5 h-full bg-[#00FF66]"></div>
        <div className="absolute right-[-2.5px] top-1/2 -translate-y-1/2 w-[1.5px] h-1.5 bg-[#00FF66]"></div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-2 overflow-hidden">
      {/* Walkie Talkie Body - Responsive constraints */}
      <div className="relative w-full max-w-[340px] h-full max-h-[680px] bg-[#1a1a1a] rounded-[40px] border-8 border-[#222] shadow-2xl flex flex-col overflow-hidden">
        
        {/* Antenna - Scaled for mobile */}
        <div className="absolute top-[-40px] left-1/2 -translate-x-1/2 w-4 h-24 bg-[#111] rounded-t-lg z-0"></div>

        {/* Volume Knob Top */}
        <div className="absolute top-[-10px] left-10 w-12 h-6 bg-[#111] rounded-t-lg border-b-4 border-[#333] z-10 cursor-pointer hover:bg-[#151515]" onClick={handlePowerToggle}>
           <div className={`w-1 h-3 bg-red-600 mx-auto mt-1 rounded-full ${isPowerOn ? 'opacity-100 shadow-[0_0_5px_red]' : 'opacity-30'}`}></div>
        </div>

        {/* LCD Display Section */}
        <div className="mt-10 px-6 sm:px-8">
          <div className="bg-[#050505] w-full h-44 sm:h-48 rounded-lg border-4 border-[#222] p-4 relative overflow-hidden flex flex-col">
            {isPowerOn ? (
              <div className="flex-1 crt-flicker">
                {/* Header Row */}
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[#00FF66] text-[8px] font-['Press_Start_2P'] uppercase tracking-tighter">RetroWave Talk</span>
                  <BatteryIndicator />
                </div>
                
                {/* Secondary Row */}
                <div className="flex justify-between items-end mb-1">
                  <div className="flex flex-col">
                    <span className="text-[#00FF66] text-[10px] font-['Press_Start_2P'] opacity-40">BAND</span>
                    <span className="text-[#00FF66] text-lg leading-none font-bold lcd-glow">{getBandNumber(frequency)}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[#00FF66] text-[10px] font-['Press_Start_2P'] opacity-40">FREQ</span>
                    <span className="text-[#00FF66] text-2xl lcd-glow font-['VT323'] tracking-wider leading-none">
                      {frequency}<span className="text-[10px] ml-1">MHz</span>
                    </span>
                  </div>
                </div>
                
                <div className="h-[1px] w-full bg-[#00FF66] opacity-30 mb-2"></div>

                <div className="space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-[#00FF66] text-[11px] opacity-60">STATUS:</span>
                    <span className={`text-[11px] ${status === RadioStatus.TALKING ? 'text-red-500 font-bold' : 'text-[#00FF66]'}`}>
                      {status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#00FF66] text-[11px] opacity-60">USER:</span>
                    <span className="text-[#00FF66] text-[11px]">{userName}</span>
                  </div>
                </div>

                <div className="mt-2">
                  <span className="text-[#00FF66] text-[8px] opacity-40 block mb-1 font-['Press_Start_2P'] uppercase">Nearby:</span>
                  <div className="space-y-0.5 max-h-12 overflow-y-auto pr-1">
                    {connectedUsers.map(u => (
                      <div key={u.id} className="flex items-center text-[#00FF66] text-[10px]">
                        <div className={`w-1 h-1 rounded-full mr-1.5 ${u.id === '2' && status === RadioStatus.LISTENING ? 'bg-green-400 animate-pulse' : 'bg-[#00FF66] opacity-40'}`}></div>
                        <span>{u.name}</span>
                        {u.id === '2' && status === RadioStatus.LISTENING && <span className="ml-2 text-[7px] animate-pulse">[RX]</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center opacity-10">
                <span className="text-[#00FF66] text-2xl font-bold">POWER OFF</span>
              </div>
            )}
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.5)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_3px,3px_100%]"></div>
          </div>
        </div>

        {/* Frequency Dial Section - Adjusted spacing */}
        <div className="flex justify-around items-center px-10 mt-6 sm:mt-10 mb-4 sm:mb-8">
           {[Frequency.F1, Frequency.F2, Frequency.F3].map(f => (
             <button
               key={f}
               onClick={() => changeFreq(f)}
               className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-[10px] transition-all
                 ${frequency === f 
                    ? 'bg-[#00FF66] border-[#00FF66] text-black shadow-[0_0_15px_#00FF66] scale-110' 
                    : 'bg-transparent border-[#444] text-[#444] hover:border-[#666]'}`}
             >
               {f === Frequency.F1 ? '1' : f === Frequency.F2 ? '2' : '3'}
             </button>
           ))}
        </div>

        {/* Speaker Grille - Adjusted spacing */}
        <div className="px-10 space-y-2 mb-4 sm:mb-8 opacity-40">
           {[...Array(5)].map((_, i) => (
             <div key={i} className="flex justify-between">
                {[...Array(8)].map((_, j) => (
                  <div key={j} className="w-4 h-1.5 bg-[#000] rounded-full"></div>
                ))}
             </div>
           ))}
        </div>

        {/* PTT Button - Responsive sizing */}
        <div className="flex-1 flex flex-col items-center justify-center bg-[#111] rounded-b-[40px] border-t-8 border-[#222]">
           <button
             onMouseDown={startTalking}
             onMouseUp={stopTalking}
             onTouchStart={(e) => { e.preventDefault(); startTalking(); }}
             onTouchEnd={(e) => { e.preventDefault(); stopTalking(); }}
             className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-[#cc3300] border-8 border-[#aa2200] transition-all active:scale-95 flex flex-col items-center justify-center radio-button-shadow
               ${status === RadioStatus.TALKING ? 'radio-button-active brightness-125' : 'hover:brightness-110'}
               ${(!isPowerOn || status === RadioStatus.LISTENING) ? 'grayscale opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
           >
              <span className="text-white font-['Press_Start_2P'] text-[10px] mb-2">PUSH</span>
              <span className="text-white font-['Press_Start_2P'] text-[12px]">TALK</span>
           </button>
        </div>
      </div>
    </div>
  );
};

export default App;
