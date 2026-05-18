import { useEffect, useState, useRef } from "react";
import { Platform } from "react-native";
import * as RN from "react-native";

interface TVEventHandlerInstance {
  enable(component: any, callback: (evt: any) => void): void;
  disable(): void;
}

interface TVEventHandlerClass {
  new (): TVEventHandlerInstance;
}

// Safely access TVEventHandler from the react-native package
const TVEventHandler = (RN as any).TVEventHandler as
  | TVEventHandlerClass
  | undefined;

export interface TVEvent {
  eventType:
    | "up"
    | "down"
    | "left"
    | "right"
    | "select"
    | "back"
    | "menu"
    | "playPause"
    | "rewind"
    | "fastForward";
  eventKeyAction?: number;
  tag?: number;
}

export const useAndroidTVFocus = () => {
  const [lastEvent, setLastEvent] = useState<TVEvent | null>(null);

  const tvEventHandlerRef = useRef<TVEventHandlerInstance | null>(null);

  const isTV = Platform.isTV;

  useEffect(() => {
    if (!isTV || !TVEventHandler) return;

    tvEventHandlerRef.current = new TVEventHandler();

    tvEventHandlerRef.current.enable(null, (evt: any) => {
      // Some RN versions wrap event in nativeEvent
      const event = evt.nativeEvent || evt;
      setLastEvent(event);
    });

    return () => {
      tvEventHandlerRef.current?.disable();
      tvEventHandlerRef.current = null;
    };
  }, [isTV]);

  return {
    isTV,
    lastEvent,
    isDpadUp: lastEvent?.eventType === "up",
    isDpadDown: lastEvent?.eventType === "down",
    isDpadLeft: lastEvent?.eventType === "left",
    isDpadRight: lastEvent?.eventType === "right",
    isDpadSelect: lastEvent?.eventType === "select",
    isDpadBack: lastEvent?.eventType === "back",
  };
};
