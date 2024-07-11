import {
  UndefinedInitialDataOptions,
  useQuery as useQueryTanstack,
  useMutation as useMutationTanstack,
  useInfiniteQuery as useInfiniteQueryTanstack,
  UseMutationOptions,
  InfiniteData,
  useQueryClient,
} from "@tanstack/react-query";
import { z } from "zod";
export type TRequestType = "get" | "post" | "put" | "delete";
type PartialUndefinedInitialDataOptions<T, E> = Partial<
  UndefinedInitialDataOptions<T, E>
>;
export type ProcedureType = "query" | "mutation" | "infinite";
export type TBuildOutput<TInferedOutput, TOutput> =
  TInferedOutput extends TOutput ? TOutput : TInferedOutput;

/**
 * A procedure is the start of a query/mutation, a wrapper that allows us to declare a query/mutation
 * Additionally, if the schema has an input, this is validated, so we make sure that the input is valid, both for
 * mutations and queries
 */
export class Procedure<TInput, TOutput = unknown, TError = unknown> {
  public key: string[] = [Math.random().toString()];
  public type: ProcedureType | null = null;
  public schemeInput: z.ZodType<TInput> | undefined;
  public schemeOutput: z.ZodType<TOutput> | undefined;
  public verifyOutput = false;
  /**
   * Makes a query call using useQuery
   * @param func Function to call
   * @param queryKey Optional different query key
   */
  query = <TInferedOutput extends TOutput>(
    func: ({
      ctx,
      input,
    }: {
      ctx: Procedure<TInput, TOutput, TError> & {
        schemeOutput: TOutput;
      };
      input?: TInput;
    }) => Promise<TInferedOutput>,
    queryKey?: string
  ) => {
    this.type = "query";
    const useDynamicQuery = (
      input: TInput,
      options?: PartialUndefinedInitialDataOptions<TInferedOutput, Error>
    ) => {
      const initialOptions: UndefinedInitialDataOptions<TInferedOutput, Error> =
        {
          queryKey: options?.queryKey ? [options.queryKey] : [queryKey],
          queryFn: async () => {
            try {
              const response = func({
                input,
                ctx: this as unknown as Procedure<TInput, TOutput, TError> & {
                  schemeOutput: TOutput;
                },
              });
              if (this.verifyOutput && this.schemeOutput) {
                const validate = this.schemeOutput.safeParse(response);
                if (validate.error) {
                  console.error("Error validating output", validate.error);
                  return Promise.reject(validate);
                }
              }
              return response as TInferedOutput;
            } catch (error) {
              console.error(error);
              return Promise.reject(error);
            }
          },
        };
      //Enforce scheme if it exists by default
      if (this.schemeInput) {
        this.schemeInput.parse(input);
      }
      return useQueryTanstack<TInferedOutput, Error>({
        ...initialOptions,
        ...options,
      });
    };
    return {
      useQuery: useDynamicQuery,
      ctx: this,
    };
  };

  infiniteQuery = (
    fns: {
      queryFn: ({ input }: { input?: TInput }) => Promise<TOutput>;
      getNextPageParam: (
        lastPage: TOutput,
        allPages: TOutput[]
      ) => TInput | undefined;
      getPreviousPageParam: (
        firstPage: TOutput,
        allPages: TOutput[]
      ) => TInput | undefined;
      initialPageParam: TInput;
      initialData?: InfiniteData<TOutput>;
    },
    queryKey?: string
  ) => {
    this.type = "infinite";
    const useDynamicInfiniteQuery = (
      input: TInput,
      options?: PartialUndefinedInitialDataOptions<TOutput, TError>
    ) => {
      const initialOptions = {
        queryKey: options?.queryKey ? [options.queryKey] : [queryKey],
        ...fns,
        queryFn: async () => {
          try {
            return fns?.queryFn({ input });
          } catch (error) {
            console.error(error);
            return Promise.reject(error);
          }
        },
      };
      //Enforce scheme if it exists
      if (this.schemeInput) {
        this.schemeInput.parse(input);
      }
      return useInfiniteQueryTanstack<TOutput, TError>({
        ...initialOptions,
      });
    };
    return {
      useInfiniteQuery: useDynamicInfiniteQuery,
      ctx: this,
    };
  };
  /**
   * Makes a mutation call using useMutation
   * @param func Function to call
   * @param mutationKey Optional different mutation key
   */
  mutation = (
    func: ({ input }: { input?: TInput }) => Promise<TOutput>,
    mutationKey?: string
  ) => {
    if (mutationKey) {
      this.key = [mutationKey];
    }
    this.type = "mutation";
    const useDynamicMutation = (
      options?: UseMutationOptions<
        TOutput,
        TError,
        { input: TInput | undefined }
      >
    ) => {
      const initialOptions: UseMutationOptions<
        TOutput,
        TError,
        { input: TInput | undefined }
      > = {
        mutationKey: options?.mutationKey
          ? [options.mutationKey]
          : [mutationKey],
        mutationFn: ({ input }: { input: TInput | undefined }) => {
          if (this.schemeInput) {
            this.schemeInput.parse(input);
          }
          return func({ input });
        },
      };
      return useMutationTanstack<
        TOutput,
        TError,
        { input: TInput | undefined }
      >({
        ...initialOptions,
        ...options,
      });
    };
    return {
      useMutation: useDynamicMutation,
      ctx: this,
    };
  };
  constructor() {
    this.key = [Math.random().toString()];
  }
  /**
   * Declares an input as a scheme for the flow
   * @param val Another Zod Scheme
   */
  input = <K,>(val: z.ZodType<K extends TInput ? K : TInput>) => {
    if (val === undefined) {
      console.warn("Input set but empty");
    }
    this.schemeInput = val as unknown as z.ZodType<TInput>;
    return this as Procedure<K extends TInput ? K : TInput, TOutput>;
  };
  /**
   * Declares an output scheme for the flow
   * @param val
   * @returns
   */
  output = <O,>(
    val: z.ZodType<O extends TOutput ? O : TOutput>,
    options?: { verifyOutput?: boolean }
  ) => {
    if (val === undefined) {
      console.warn("Output set but empty");
    }
    if (val) {
      this.schemeOutput = val;
    }
    if (options?.verifyOutput) {
      this.verifyOutput = options.verifyOutput;
    }

    return this as Procedure<TInput, O extends TOutput ? O : TOutput>;
  };
}
/**
 * Creates a flow to communicate with the backend through a reusable procedure
 */
export class Flow {
  static procedure = new Procedure();
}
export type ReturnUseUtils<ResultFlow> = {
  [K in keyof ResultFlow]: {
    [K2 in keyof ResultFlow[K]]: ResultFlow[K][K2] extends {
      useQuery: any;
      ctx: any;
    }
      ? {
          invalidate: () => Promise<void>;
          refetch: () => Promise<void>;
        }
      : never;
  };
};

export class Utils<T extends Record<string, Record<string, any>>> {
  private val: T;
  constructor(val: T) {
    this.val = val;
  }

  /**
   * TODO: Fix type casting with generics or infer, idk
   */
  useUtils = () => {
    const queryClient = useQueryClient();
    return Object.entries(this.val).reduce((prev, [key, value]) => {
      const values = Object.entries(value).reduce((prev, [key2, value2]) => {
        if (value2.ctx.type === "mutation" || !value2.ctx.type) {
          return {
            ...prev,
          };
        }
        return {
          ...prev,
          [key2]: {
            invalidate: () => {
              return queryClient.invalidateQueries({
                queryKey: value2.ctx.key,
              });
            },
            refetch: () => {
              return queryClient.refetchQueries({
                queryKey: value2.ctx.key,
              });
            },
          },
        };
      }, {});
      return {
        [key]: values,
        ...prev,
      };
    }, {}) as ReturnUseUtils<T>;
  };
}
//TODO: Fix non any types
export const apiBuilder = <FuncionList extends Record<string, any>>(
  val: FuncionList
) => {
  return { utils: new Utils(val), ...val };
};

