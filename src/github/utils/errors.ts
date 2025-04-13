export interface RequestError extends Error {
  status?: number;
}

export interface GraphQLError {
  message: string;
  type?: string;
}

export interface GraphQLResponse {
  errors?: GraphQLError[];
}
