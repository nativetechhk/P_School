// Web Speech API minimal typings
interface SpeechRecognitionResult { 0: { transcript: string }; readonly length: number }
interface SpeechRecognitionEvent extends Event {
  readonly results: { 0: SpeechRecognitionResult; readonly length: number };
}
interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
}
