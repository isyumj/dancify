import { useState, useCallback } from 'react';
import {
  getSegmentsForVideo,
  insertSegment,
  deleteSegment,
} from '../db/database';
import { Segment } from '../types';

export function useSegments(videoId: number) {
  const [segments, setSegments] = useState<Segment[]>([]);

  const load = useCallback(async () => {
    const rows = await getSegmentsForVideo(videoId);
    setSegments(rows);
  }, [videoId]);

  const addSegment = useCallback(
    async (startTime: number, endTime: number) => {
      const id = await insertSegment(videoId, startTime, endTime);
      const newSeg: Segment = {
        id,
        videoId,
        startTime,
        endTime,
        createdAt: new Date().toISOString(),
      };
      setSegments((prev) =>
        [...prev, newSeg].sort((a, b) => a.startTime - b.startTime)
      );
      return newSeg;
    },
    [videoId]
  );

  const removeSegment = useCallback(async (segmentId: number) => {
    await deleteSegment(segmentId);
    setSegments((prev) => prev.filter((s) => s.id !== segmentId));
  }, []);

  return { segments, load, addSegment, removeSegment };
}
