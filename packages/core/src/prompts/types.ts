import type { ChatMessage } from "../llm/types.js";

import { Settings } from "../Settings.js";

import mustache from "mustache";

import * as yaml from "yaml";

interface Env {
  llm?: string;
  lang?: string;
}

type Inputs = Record<string, string>;

type FunctionResult = string | ChatMessage[];

interface ParsedTemplate {
  [key: string]: any;
}

export class Prompt {
  template: string;

  constructor(template: string) {
    this.template = template;
  }

  format(inputs: Inputs, env?: Env): FunctionResult {
    const parsedTemplate: ParsedTemplate = yaml.parse(this.template);

    let templateSection = null;
    let defaultSection = null;

    // Determine the language and LLM settings to use, either from the environment or the global settings.
    const envLang = env?.lang || Settings?.prompt?.lang;
    const envLlm = env?.llm || Settings?.prompt?.llm;

    // Regular expressions for matching language and LLM keys, including defaults.
    const langRegex = new RegExp(`^lang-(${envLang}|default)$`, "i");
    const llmRegex = new RegExp(`^llm-(${envLlm}|default)$`, "i");

    // First, look for language matches or language defaults.
    Object.entries(parsedTemplate).forEach(([key, value]) => {
      if (langRegex.test(key)) {
        templateSection = value; // Select the matching language section or a default language section.

        // Then, within the selected language section, look for LLM matches or LLM defaults.
        if (templateSection && typeof templateSection === "object") {
          Object.entries(templateSection).forEach(
            ([nestedKey, nestedValue]) => {
              if (llmRegex.test(nestedKey)) {
                templateSection = nestedValue; // Further refine to LLM section if available, including defaults.
              } else if (/^default$/.test(nestedKey)) {
                templateSection = nestedValue;
              }
            },
          );
        }
      } else if (llmRegex.test(key)) {
        templateSection = value;
      } else if (/^default$/.test(key)) {
        // Keep track of a root-level default to use if no other matches are found.
        defaultSection = value;
      }
    });

    // If no specific matches were found, use the root-level default section if available.
    if (!templateSection && defaultSection) {
      templateSection = defaultSection;
    } else if (!templateSection && !defaultSection) {
      // If no matches were found, set a single prompt
      templateSection = parsedTemplate;
    }

    // Process the selected template section for message rendering or other logic.
    if (templateSection && templateSection["messages"]) {
      const result: ChatMessage[] = [];
      for (const message of templateSection["messages"] as ChatMessage[]) {
        result.push({
          content: mustache.render(message.content, inputs),
          role: message.role,
        });
      }
      return result;
    } else if (typeof templateSection === "string") {
      const renderedResult = mustache.render(templateSection, inputs);
      return renderedResult;
    } else {
      throw new Error("Invalid template section");
    }
  }

  partial(inputs: Record<string, string>): Prompt {
    const template = mustache.render(this.template, inputs);
    return new Prompt(template);
  }

  toJSON(): Record<string, any> {
    return {
      template: this.template,
    };
  }
}