export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface Bot {
  model: string;
  name: string;
  owned: string;
  source: string;
  status: string;
  surfaces?: string[];
  note?: string;
  env?: string;
  key?: string;
}
