declare module "shopify-node-api" {
        type UtilRequest = (
                endpoint: string,
                data: Record<string, string>,
                callback: (
                        error: null | Error,
                        data: Record<string, unknown>,
                        headers?: Record<string, string>,
                ) => void,
        ) => void
        type ResponseSignature = {
                hmac: string
                signature: string
                code: string
                nonce: string
        }
        type BaseConfig = {
                shop: string
                shopify_api_key: string
                backoff_level?: number
                verbose?: boolean
                verbose_body?: boolean
                verbose_status?: boolean
                verbose_headers?: boolean
                verbose_api_limit?: boolean
        }
        export type PublicAppConfig = BaseConfig & {
                shopify_shared_secret: string
                shopify_scope: string
                redirect_uri: string
                nonce: string
        }

        export type PrivateAppConfig = BaseConfig & {
                access_token: string
        }

        export default class ShopifyAPI {
                public config: PublicAppConfig | PrivateAppConfig

                /**
                 * Configure this instance of the Shopify node api_
                 * @param {PublicAppConfig | PrivateAppConfig} config to init.
                 */
                constructor(config: PublicAppConfig | PrivateAppConfig)

                buildAuthURL(): string
                set_access_token(token: string): void
                conditional_console_log(message: unknown): void
                is_valid_signature(params: ResponseSignature, non_state?: boolean): boolean
                exchange_temporary_token(
                        query_params: ResponseSignature,
                        callback: (
                                error: null | Error,
                                data: null | Record<"access_token", string>,
                        ) => void,
                ): void
                hostname(): string
                port(): 443
                makeRequest(
                        endpoint: string,
                        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
                        callback: (
                                error: null | Error,
                                data: Record<string, unknown>,
                                headers?: Record<string, string>,
                        ) => void,
                        retry?: boolean,
                ): void

                get: UtilRequest
                post: UtilRequest
                put: UtilRequest
                delete: UtilRequest
                patch: UtilRequest

                graphql(
                        action: Record<string | symbol | number, unknown>,
                        callback: (
                                error: null | Error,
                                data: null | Record<string, unknown>,
                        ) => void,
                ): void

                has_header(response: Response, header: string): boolean
        }
}
