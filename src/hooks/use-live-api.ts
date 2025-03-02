/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MultimodalLiveAPIClientConnection,
  MultimodalLiveClient,
} from "../lib/multimodal-live-client";
import { LiveConfig } from "../multimodal-live-types";
import { AudioStreamer } from "../lib/audio-streamer";
import { audioContext } from "../lib/utils";
import VolMeterWorket from "../lib/worklets/vol-meter";

export type UseLiveAPIResults = {
  client: MultimodalLiveClient;
  setConfig: (config: LiveConfig) => void;
  config: LiveConfig;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  volume: number;
  textResponses: string[];
  userMessages: string[];
};

export function useLiveAPI({
  url,
  apiKey,
}: MultimodalLiveAPIClientConnection): UseLiveAPIResults {
  const client = useMemo(
    () => new MultimodalLiveClient({ url, apiKey }),
    [url, apiKey],
  );
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const currentResponseRef = useRef<string>("");

  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<LiveConfig>({
    model: "models/gemini-2.0-flash-exp",
  });
  const [volume, setVolume] = useState(0);
  const [textResponses, setTextResponses] = useState<string[]>([]);
  const [userMessages, setUserMessages] = useState<string[]>([]);

  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: "audio-out" }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet<any>("vumeter-out", VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          })
          .then(() => {
            // Successfully added worklet
          });
      });
    }
  }, [audioStreamerRef]);

  useEffect(() => {
    const onClose = () => {
      setConnected(false);
    };

    const stopAudioStreamer = () => audioStreamerRef.current?.stop();

    const onAudio = (data: ArrayBuffer) =>
      audioStreamerRef.current?.addPCM16(new Uint8Array(data));

    // Handle model responses
    const onServerContent = (content: any) => {
      if (content.modelTurn?.parts) {
        const textParts = content.modelTurn.parts
          .filter((p: any) => p.text)
          .map((p: any) => p.text)
          .join(" ");

        if (textParts.trim()) {
          console.log("📝 Model response:", textParts);
          currentResponseRef.current += textParts;
        }
      }
    };

    // Handle turn completion
    const onTurnComplete = () => {
      console.log("Turn complete");
      if (currentResponseRef.current.trim()) {
        setTextResponses(prev => [...prev, currentResponseRef.current.trim()]);
        currentResponseRef.current = ""; // Reset for next turn
      }
    };

    // Handle user messages
    const onClientContent = (message: any) => {
      if (message.clientContent?.turns) {
        const userText = message.clientContent.turns
          .map((turn: any) => 
            turn.parts
              .filter((p: any) => p.text)
              .map((p: any) => p.text)
              .join(" ")
          )
          .join(" ");

        if (userText.trim()) {
          console.log("🗣️ User message:", userText);
          setUserMessages(prev => [...prev, userText]);
        }
      }
    };

    client
      .on("close", onClose)
      .on("interrupted", stopAudioStreamer)
      .on("audio", onAudio)
      .on("content", onServerContent)
      .on("turncomplete", onTurnComplete)
      .on("clientContent", onClientContent);

    return () => {
      client
        .off("close", onClose)
        .off("interrupted", stopAudioStreamer)
        .off("audio", onAudio)
        .off("content", onServerContent)
        .off("turncomplete", onTurnComplete)
        .off("clientContent", onClientContent);
    };
  }, [client]);

  const connect = useCallback(async () => {
    console.log("Connecting with config:", config);
    if (!config) {
      throw new Error("config has not been set");
    }
    client.disconnect();
    await client.connect(config);
    setConnected(true);
  }, [client, setConnected, config]);

  const disconnect = useCallback(async () => {
    client.disconnect();
    setConnected(false);
  }, [setConnected, client]);

  return {
    client,
    config,
    setConfig,
    connected,
    connect,
    disconnect,
    volume,
    textResponses,
    userMessages,
  };
}
