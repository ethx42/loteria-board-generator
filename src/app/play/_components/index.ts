/**
 * Play Components Barrel Export
 *
 * @module app/play/_components
 */

// Host Display Components
export { CurrentCard } from "./current-card";
export { TextPanel } from "./text-panel";
export { HistoryStrip } from "./history-strip";
export { ControlsBar } from "./controls-bar";
export { HistoryModal } from "./history-modal";
export { HostDisplay } from "./host-display";

// Remote Controller Components
export { ConnectionStatusIndicator, useConnectionStatus } from "./connection-status";
export type { ConnectionStatus } from "./connection-status";
export { DrawButton } from "./draw-button";
export { MiniCard } from "./mini-card";
export { RemoteController } from "./remote-controller";
export type { ControllerGameState } from "./remote-controller";

// Pairing Components
export { QRPairing } from "./qr-pairing";

