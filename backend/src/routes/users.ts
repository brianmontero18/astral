import type { FastifyInstance } from "fastify";
import { createUser, getUser, updateUser, deleteUser } from "../db.js";

export async function userRoutes(app: FastifyInstance) {
  app.post<{ Body: { name: string; profile: object } }>("/users", async (req, reply) => {
    const { name, profile } = req.body;
    if (!name || !profile) {
      return reply.status(400).send({ error: "Missing name or profile" });
    }
    const id = await createUser(name, profile);
    return reply.status(201).send({ id });
  });

  app.get<{ Params: { id: string } }>("/users/:id", async (req, reply) => {
    const user = await getUser(req.params.id);
    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }
    return reply.send(user);
  });

  app.put<{ Params: { id: string }; Body: { name: string; profile: object; intake?: object } }>(
    "/users/:id",
    async (req, reply) => {
      const { name, profile, intake } = req.body;
      if (!name || !profile) {
        return reply.status(400).send({ error: "Missing name or profile" });
      }
      const updated = await updateUser(req.params.id, name, profile, intake);
      if (!updated) {
        return reply.status(404).send({ error: "User not found" });
      }
      return reply.send({ ok: true });
    },
  );

  app.delete<{ Params: { id: string } }>("/users/:id", async (req, reply) => {
    const deleted = await deleteUser(req.params.id);
    if (!deleted) {
      return reply.status(404).send({ error: "User not found" });
    }
    return reply.send({ ok: true });
  });
}
