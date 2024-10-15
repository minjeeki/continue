import {
  BrowserSerializedContinueConfig,
  ContinueConfig,
  IContextProvider,
} from "../index.js";

import { finalToBrowserConfig } from "./load.js";

import { IProfileLoader } from "./profile/IProfileLoader.js";
import { ValidationError } from "./validation.js";

export interface ProfileDescription {
  title: string;
  id: string;
}

export class ProfileLifecycleManager {
  private savedConfig: ContinueConfig | undefined;
  private savedBrowserConfig?: BrowserSerializedContinueConfig;
  private pendingConfigPromise?: Promise<ContinueConfig>;

  constructor(private readonly profileLoader: IProfileLoader) {}

  get profileId() {
    return this.profileLoader.profileId;
  }

  get profileTitle() {
    return this.profileLoader.profileTitle;
  }

  get profileDescription(): ProfileDescription {
    return {
      title: this.profileTitle,
      id: this.profileId,
    };
  }

  clearConfig() {
    this.savedConfig = undefined;
    this.savedBrowserConfig = undefined;
    this.pendingConfigPromise = undefined;
  }

  // Clear saved config and reload
  async reloadConfig(): Promise<ContinueConfig> {
    this.savedConfig = undefined;
    this.savedBrowserConfig = undefined;
    this.pendingConfigPromise = undefined;

    return this.profileLoader.doLoadConfig();
  }

  async loadConfig(
    additionalContextProviders: IContextProvider[],
  ): Promise<ContinueConfig> {
    // If we already have a config, return it
    if (this.savedConfig) {
      return this.savedConfig;
    } else if (this.pendingConfigPromise) {
      return this.pendingConfigPromise;
    }

    // Set pending config promise
    this.pendingConfigPromise = new Promise(async (resolve, reject) => {
      try {
        const newConfig = await this.profileLoader.doLoadConfig();

        // Add registered context providers
        newConfig.contextProviders = (newConfig.contextProviders ?? []).concat(
          additionalContextProviders,
        );

        this.savedConfig = newConfig;
        resolve(newConfig);
      } catch (error) {
        if (error instanceof ValidationError) {
          reject(`Error in config.json: ${error.errors.join(" | ")}`);
        } else {
          reject(error);
        }
      }
    });

    // Wait for the config promise to resolve
    this.savedConfig = await this.pendingConfigPromise;
    this.pendingConfigPromise = undefined;
    return this.savedConfig;
  }

  async getSerializedConfig(
    additionalContextProviders: IContextProvider[],
  ): Promise<BrowserSerializedContinueConfig> {
    if (!this.savedBrowserConfig) {
      const continueConfig = await this.loadConfig(additionalContextProviders);
      this.savedBrowserConfig = finalToBrowserConfig(continueConfig);
    }
    return this.savedBrowserConfig;
  }
}