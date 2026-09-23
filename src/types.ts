export type Role = 'user' | 'model';

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: Date;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

/** Which backend a model is reached through. */
export type Provider = 'hf' | 'openrouter' | 'local';

/** How the UI groups a model in the pickers. */
export type ModelType = 'obliterated' | 'original' | 'free' | 'local';

export interface ModelDescriptor {
  id: string;
  name: string;
  provider: Provider | string;
  type: ModelType | string;
}
