// Error con la forma que el cliente Axios espera de la API real (response.status / response.data.message).
export class MockApiError extends Error {
  response: { status: number; data: { message: string } };
  constructor(status: number, message: string) {
    super(message);
    this.response = { status, data: { message } };
  }
}
