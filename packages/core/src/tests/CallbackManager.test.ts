import { VectorStoreIndex } from "../BaseIndex";
import { OpenAIEmbedding } from "../Embedding";
import { ChatOpenAI } from "../LanguageModel";
import { Document } from "../Node";
import { ServiceContext, serviceContextFromDefaults } from "../ServiceContext";
import {
  CallbackManager,
  RetrievalCallbackResponse,
  StreamCallbackResponse,
} from "../callbacks/CallbackManager";
import { mockEmbeddingModel, mockLlmGeneration } from "./utility/mockOpenAI";

// Mock the OpenAI getOpenAISession function during testing
jest.mock("../openai", () => {
  return {
    getOpenAISession: jest.fn().mockImplementation(() => null),
  };
});

describe("CallbackManager: onLLMStream and onRetrieve", () => {
  let vectorStoreIndex: VectorStoreIndex;
  let serviceContext: ServiceContext;
  let streamCallbackData: StreamCallbackResponse[] = [];
  let retrieveCallbackData: RetrievalCallbackResponse[] = [];
  let document: Document;

  beforeAll(async () => {
    document = new Document({ text: "Author: My name is Paul Graham" });
    const callbackManager = new CallbackManager({
      onLLMStream: (data) => {
        streamCallbackData.push(data);
      },
      onRetrieve: (data) => {
        retrieveCallbackData.push(data);
      },
    });

    const languageModel = new ChatOpenAI({
      model: "gpt-3.5-turbo",
      callbackManager,
    });
    mockLlmGeneration({ languageModel, callbackManager });

    const embedModel = new OpenAIEmbedding();
    mockEmbeddingModel(embedModel);

    serviceContext = serviceContextFromDefaults({
      callbackManager,
      llm: languageModel,
      embedModel,
    });

    vectorStoreIndex = await VectorStoreIndex.fromDocuments(
      [document],
      undefined,
      serviceContext
    );
  });

  beforeEach(() => {
    streamCallbackData = [];
    retrieveCallbackData = [];
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  test("For VectorStoreIndex w/ a SimpleResponseBuilder", async () => {
    const queryEngine = vectorStoreIndex.asQueryEngine();
    const query = "What is the author's name?";
    const response = await queryEngine.aquery(query);
    expect(response.toString()).toBe("MOCK_TOKEN_1-MOCK_TOKEN_2");
    expect(streamCallbackData).toEqual([
      {
        trace: {
          id: expect.any(String),
          parentId: expect.any(String),
        },
        index: 0,
        token: {
          id: "id",
          object: "object",
          created: 1,
          model: "model",
          choices: expect.any(Array),
        },
      },
      {
        trace: {
          id: expect.any(String),
          parentId: expect.any(String),
        },
        index: 1,
        token: {
          id: "id",
          object: "object",
          created: 1,
          model: "model",
          choices: expect.any(Array),
        },
      },
      {
        trace: {
          id: expect.any(String),
          parentId: expect.any(String),
        },
        index: 2,
        isDone: true,
      },
    ]);
    expect(retrieveCallbackData).toEqual([
      {
        query: query,
        nodes: expect.any(Array),
        trace: {
          id: expect.any(String),
          parentId: expect.any(String),
        },
      },
    ]);
    // both retrieval and streaming should have
    // the same parent trace
    expect(streamCallbackData[0].trace.parentId).toBe(
      retrieveCallbackData[0].trace.parentId
    );
  });
});
