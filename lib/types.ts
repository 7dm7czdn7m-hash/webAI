export type TutorRun = {
  id: string;
  provider: string;
  final: string;
  units?: string;
  short_reason: string;
  check: string;
  score: number;
  signals: string[];
};

export type TutorPrompt = {
  content: string;
  imageBase64?: string;
};

export type TutorSummary = {
  final: string;
  units?: string;
  short_reason: string;
  check: string;
  provider: string;
  reason: string;
};

export type ArbiterDecision = {
  winner: TutorRun;
  reason: string;
  consensus: boolean;
};
