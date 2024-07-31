import { QueryKey, UseInfiniteQueryOptions } from "@tanstack/react-query";
import { UndefinedInitialDataInfiniteOptions } from "@tanstack/react-query";
import { DefinedInitialDataInfiniteOptions } from "@tanstack/react-query";
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
  public key: QueryKey = [Math.random().toString()];
  public type: ProcedureType | null = null;
  public schemeInput: z.ZodType<TInput> | undefined;
  public schemeOutput: z.ZodType<TOutput> | undefined;
  public verifyOutput = false;

  isValidSchema = (schema: z.ZodType<unknown>, data: unknown) => {
    const validate = schema.safeParse(data);

    if (validate.error) {
      console.error(
        "Error validating schema, input/output does not match the schema:",
        this.key,
        data
      );
      console.error("Error in key", this.key);
      console.error("Error Data", validate);
      return {
        ok: false,
        res: validate,
      };
    }
    return {
      ok: true,
      res: validate,
    };
  };

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
    queryKey: QueryKey
  ) => {
    this.type = "query";
    this.key = [queryKey];
    const useDynamicQuery = (
      input: TInput,
      options?: PartialUndefinedInitialDataOptions<TInferedOutput, Error>
    ) => {
      const initialOptions: UndefinedInitialDataOptions<TInferedOutput, Error> =
        {
          queryKey: options?.queryKey
            ? [queryKey, options.queryKey]
            : [queryKey],
          queryFn: async () => {
            try {
              const response = func({
                input,
                ctx: this as unknown as Procedure<TInput, TOutput, TError> & {
                  schemeOutput: TOutput;
                },
              });
              if (this.verifyOutput && this.schemeOutput) {
                const isValid = this.isValidSchema(
                  this.schemeOutput,
                  await response
                );
                if (!isValid.ok) {
                  return Promise.reject(isValid.res.error);
                }
              }
              return response as TInferedOutput;
            } catch (error) {
              console.error(error);
              return Promise.reject(error);
            }
          },
        };
      if (options?.queryKey) {
        this.key = [queryKey, options?.queryKey];
        options.queryKey = this.key;
      }
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
  infiniteQuery = <
    TInferedOutput extends TOutput
    // nextPageParams: Record<string, unknown>
    // previousPageParams: Record<string, unknown>
  >(
    queryFn: ({
      input,
      ctx,
    }: {
      input?: TInput;
      ctx: Procedure<TInput, TOutput, TError> & { schemeOutput: TOutput };
    }) => Promise<TInferedOutput>,
    queryKey: QueryKey
  ) => {
    this.type = "infinite";
    this.key = [queryKey];
    const useDynamicInfiniteQuery = (
      input: TInput,
      options: Omit<
        UndefinedInitialDataInfiniteOptions<TInferedOutput, TError>,
        "queryKey"
      > & { queryKey?: QueryKey }
    ) => {
      const initialOptions: UndefinedInitialDataInfiniteOptions<
        TInferedOutput,
        TError
      > = {
        queryFn: async () => {
          try {
            return queryFn({
              input,
              ctx: this as unknown as Procedure<TInput, TOutput, TError> & {
                schemeOutput: TOutput;
              },
            });
          } catch (error) {
            console.error(error);
            return Promise.reject(error);
          }
        },
        ...options,
        // queryKey: options?.queryKey ? [options.queryKey] : [queryKey],
        queryKey: options?.queryKey ? [queryKey, options.queryKey] : [queryKey],
      };
      //Enforce scheme if it exists
      if (this.schemeInput) {
        // this.schemeInput.parse(input);
        const isValid = this.isValidSchema(this.schemeInput, input);
        if (!isValid.ok) {
          return Promise.reject(isValid.res.error);
        }
      }
      if (options?.queryKey) {
        this.key = [queryKey, options?.queryKey];
        options.queryKey = this.key;
      }
      return useInfiniteQueryTanstack<TInferedOutput, TError>({
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
    mutationKey: QueryKey
  ) => {
    this.type = "mutation";
    this.key = [mutationKey];
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
          ? [mutationKey, options.mutationKey]
          : [mutationKey],
        mutationFn: ({ input }: { input: TInput | undefined }) => {
          if (this.schemeInput) {
            const isValid = this.isValidSchema(this.schemeInput, input);
            if (!isValid.ok) {
              return Promise.reject(isValid.res.error);
            }
          }
          return func({ input });
        },
      };
      if (options?.mutationKey) {
        this.key = [mutationKey, options.mutationKey];
        options.mutationKey = this.key;
      }
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
  static get procedure() {
    return new Procedure();
  }
}
export type ReturnUseUtils<ResultFlow> = {
  [K in keyof ResultFlow]: {
    [K2 in keyof ResultFlow[K]]: ResultFlow[K][K2] extends {
      useQuery: any;
      ctx: any;
    }
      ? {
          //Returns the invalidated key
          invalidate: () => Promise<string>;
          refetch: () => Promise<string>;
          abort: () => Promise<string>;
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
              queryClient.invalidateQueries({
                queryKey: value2.ctx.key,
              });
              return value2.ctx.key;
            },
            refetch: () => {
              queryClient.refetchQueries({
                queryKey: value2.ctx.key,
              });
              return value2.ctx.key;
            },
            abort: () => {
              queryClient.cancelQueries({
                queryKey: value2.ctx.key,
              });
              return value2.ctx.key;
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
