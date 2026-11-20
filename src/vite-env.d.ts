/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Address of the separate property-manager app (set on the renter project). */
  readonly VITE_MANAGER_URL?: string;
  /** Address of the renter app (set on the manager project, for the "Back to RentWell" link). */
  readonly VITE_RENTER_URL?: string;
}
