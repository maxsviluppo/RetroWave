
export enum Frequency {
  F1 = '433.10',
  F2 = '433.20',
  F3 = '433.30'
}

export enum RadioStatus {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  TALKING = 'TALKING',
  CONNECTING = 'CONNECTING',
  ERROR = 'ERROR'
}

export interface User {
  id: string;
  name: string;
  status: RadioStatus;
}
