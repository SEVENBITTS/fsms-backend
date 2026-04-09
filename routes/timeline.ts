import { Router, Request, Response, NextFunction } from "express";
import { TimelineQuerySchema, TimelineWriteSchema } from "../schemas/timeline.schemas";
import { HttpError } from "../utils/errors";
import { TimelineService } from "../services/timeline.service";

export function createTimelineRouter(timelineService: TimelineService): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = TimelineQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        return next(new HttpError(400, parsed.error.message));
      }

      const response = await timelineService.listTimelineEvents(parsed.data);
      return res.json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = TimelineWriteSchema.safeParse(req.body);

      if (!parsed.success) {
        return next(new HttpError(400, parsed.error.message));
      }

      const response = await timelineService.appendTimelineEvent(parsed.data);
      return res.status(201).json(response);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}