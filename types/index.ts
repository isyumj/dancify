export interface Video {
  id: number;
  filename: string;
  duration: number; // seconds
  localPath: string;
  thumbnailPath?: string;
  createdAt: string; // ISO string
}

export interface Segment {
  id: number;
  videoId: number;
  startTime: number; // seconds
  endTime: number; // seconds
  createdAt: string;
}

export type PlaybackSpeed = 0.5 | 0.7 | 0.8 | 0.9 | 1.0;
