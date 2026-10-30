import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HealthMonitor } from "@/components/HealthMonitor";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

const expressHealthy: Record<string, unknown> = {
  "/health": { status: "healthy", service: "express-mongodb-api" },
  "/health/app": { status: "healthy", service: "express-mongodb-api", database: { status: "healthy", type: "mongodb" } },
  "/health/db": { status: "healthy", database: "mongodb", message: "Database connection successful" },
};

function fakeBackend(respond: (path: string, origin: string) => Response) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    return respond(url.pathname, url.origin);
  });
}

const card = (label: string) => screen.getByRole("region", { name: label });
const overview = () => screen.getByRole("region", { name: "Overview" });

describe("HealthMonitor", () => {
  it("offers all six sample backends and makes no request on load", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<HealthMonitor />);
    const samples = within(screen.getByRole("group", { name: "Sample configurations" }));
    for (const label of [
      "Django + PostgreSQL",
      "FastAPI + MySQL",
      "Express.js + MongoDB",
      "Go + Cassandra",
      "PHP + SQLite",
      "Python + Redis + InfluxDB",
    ]) {
      expect(samples.getByRole("button", { name: new RegExp(label.replace(/[+.]/g, "\\$&")) })).toBeInTheDocument();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("each button calls its own endpoint on the selected backend", async () => {
    const fetchSpy = fakeBackend((path) => json(200, expressHealthy[path]));
    const user = userEvent.setup();
    render(<HealthMonitor />);

    await user.click(screen.getByRole("button", { name: /Express\.js \+ MongoDB/ }));
    await user.click(screen.getByRole("button", { name: "Check API Health" }));
    await user.click(screen.getByRole("button", { name: "Check Application Health" }));
    await user.click(screen.getByRole("button", { name: "Check Database Health" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3));
    expect(fetchSpy.mock.calls.map(([url]) => String(url))).toEqual([
      "http://localhost:8003/health",
      "http://localhost:8003/health/app",
      "http://localhost:8003/health/db",
    ]);
  });

  it("Check All fills the overview and every card", async () => {
    fakeBackend((path) => json(200, expressHealthy[path]));
    const user = userEvent.setup();
    render(<HealthMonitor />);

    await user.click(screen.getByRole("button", { name: /Express\.js/ }));
    await user.click(screen.getByRole("button", { name: "Check All" }));

    await waitFor(() => expect(within(overview()).getByText("express-mongodb-api")).toBeInTheDocument());
    expect(within(overview()).getByText("mongodb")).toBeInTheDocument();
    expect(within(overview()).queryByText("Never")).not.toBeInTheDocument();
    for (const label of ["API Health", "Application Health", "Database Health"]) {
      expect(within(card(label)).getByText("Healthy")).toBeInTheDocument();
      expect(within(card(label)).getByText("200")).toBeInTheDocument();
      expect(within(card(label)).getByText("Raw JSON response")).toBeInTheDocument();
    }
  });

  it("shows unhealthy, network error and invalid URL states", async () => {
    fakeBackend((path, origin) => {
      if (origin === "http://localhost:8002") throw new TypeError("Failed to fetch");
      return path === "/health" ? json(200, { status: "healthy" }) : json(503, { status: "unhealthy" });
    });
    const user = userEvent.setup();
    render(<HealthMonitor />);

    // Default sample (Django): database down
    await user.click(screen.getByRole("button", { name: "Check All" }));
    await waitFor(() => expect(within(card("Database Health")).getByText("Unhealthy")).toBeInTheDocument());
    expect(within(card("Database Health")).getByText("503")).toBeInTheDocument();
    expect(within(card("API Health")).getByText("Healthy")).toBeInTheDocument();

    // FastAPI sample: not reachable
    await user.click(screen.getByRole("button", { name: /FastAPI/ }));
    expect(within(card("API Health")).getByText("Not checked")).toBeInTheDocument(); // old results cleared
    await user.click(screen.getByRole("button", { name: "Check API Health" }));
    await waitFor(() => expect(within(card("API Health")).getByText("Network error")).toBeInTheDocument());

    // Custom invalid URL
    const input = screen.getByLabelText("Backend API base URL");
    await user.clear(input);
    await user.type(input, "localhost:9999");
    expect(screen.getByText(/Custom URL/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Check API Health" }));
    await waitFor(() => expect(within(card("API Health")).getByText("Invalid URL")).toBeInTheDocument());
    expect(within(card("API Health")).getByText(/Did you mean http:\/\/localhost:9999/)).toBeInTheDocument();
  });

  it("shows the per-database breakdown for the Python backend", async () => {
    fakeBackend(() =>
      json(503, {
        status: "unhealthy",
        database: "redis,influxdb",
        databases: { redis: { status: "unhealthy" }, influxdb: { status: "healthy" } },
      }),
    );
    const user = userEvent.setup();
    render(<HealthMonitor />);

    await user.click(screen.getByRole("button", { name: /Python \+ Redis/ }));
    await user.click(screen.getByRole("button", { name: "Check Database Health" }));

    const breakdown = await screen.findByRole("list", { name: "Database breakdown" });
    expect(within(breakdown).getByText("redis").closest("li")).toHaveTextContent("Unhealthy");
    expect(within(breakdown).getByText("influxdb").closest("li")).toHaveTextContent("Healthy");
  });
});
