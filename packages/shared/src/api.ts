import type { Tab } from "./categories.js";

// A top-level comment as read from YouTube, before classification.
export interface RawComment {
  id: string;
  text: string;
}

// POST /api/classify — sent by the extension, one video at a time.
export interface ClassifyRequest {
  videoId: string;
  videoTitle: string;
  comments: RawComment[];
}

export interface ClassificationResult {
  commentId: string;
  category: Tab;
  confidence: number;
}

export interface ClassifyResponse {
  results: ClassificationResult[];
}

// POST /api/corrections — sent when the user flags a comment as misclassified.
export interface CorrectionRequest {
  commentId: string;
  originalCategory: Tab;
  correctedCategory: Tab;
  modelVersion: string;
}
