import { Router, type IRouter } from "express";
import { db, roomsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { CreateRoomBody, GetRoomParams, VerifyRoomPasswordParams, VerifyRoomPasswordBody } from "@workspace/api-zod";

const router: IRouter = Router();

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let password = "";
  for (let i = 0; i < 6; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

router.post("/rooms", async (req, res) => {
  const parsed = CreateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { hostName } = parsed.data;
  const id = uuidv4();
  const password = generatePassword();

  await db.insert(roomsTable).values({ id, hostName, password });

  const room = await db.select().from(roomsTable).where(eq(roomsTable.id, id)).limit(1);

  res.status(201).json({
    id: room[0].id,
    hostName: room[0].hostName,
    createdAt: room[0].createdAt.toISOString(),
    password,
  });
});

router.get("/rooms/:roomId", async (req, res) => {
  const parsed = GetRoomParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid room ID" });
    return;
  }

  const room = await db
    .select()
    .from(roomsTable)
    .where(eq(roomsTable.id, parsed.data.roomId))
    .limit(1);

  if (room.length === 0) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  res.json({
    id: room[0].id,
    hostName: room[0].hostName,
    createdAt: room[0].createdAt.toISOString(),
  });
});

router.post("/rooms/:roomId/verify", async (req, res) => {
  const paramsParsed = VerifyRoomPasswordParams.safeParse(req.params);
  const bodyParsed = VerifyRoomPasswordBody.safeParse(req.body);

  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const room = await db
    .select()
    .from(roomsTable)
    .where(eq(roomsTable.id, paramsParsed.data.roomId))
    .limit(1);

  if (room.length === 0) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  const valid = room[0].password === bodyParsed.data.password.toUpperCase();
  if (!valid) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }

  const token = `guest-${uuidv4()}`;
  res.json({ valid: true, token });
});

export default router;
