COMPOSE ?= docker compose

.DEFAULT_GOAL := help
.PHONY: help build up dev seed stop clean test logs

help: ## Show the available targets
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-8s\033[0m %s\n", $$1, $$2}'

build: ## Build the Docker images, including the end-to-end test runner
	$(COMPOSE) --profile test build

up: ## Start the whole stack and wait until it is serving
	$(COMPOSE) up -d --wait
	@echo ""
	@echo "  API:      http://localhost:8000/api/jobs/"
	@echo "  Admin:    http://localhost:8000/admin/"
	@echo "  Postgres: localhost:5433 (jobs/jobs)"

# The containerised frontend publishes 5173, which is also Vite's port, so it is
# stopped here to leave the port free for the local dev server.
dev: ## Run only the API and database, for developing the frontend locally
	$(COMPOSE) up -d --wait db backend
	$(COMPOSE) stop frontend
	@echo ""
	@echo "  Then, in ./frontend:  nvm use && npm install && npm run dev"
	@echo "  The dev server proxies /api to http://localhost:8000"

seed: ## Replace the data with sample jobs covering every status
	$(COMPOSE) exec backend python manage.py seed_jobs --clear

# Brings the stack up itself rather than assuming `make up` has been run, so a
# clean checkout can go straight to `make test`. It is repeatable whatever is in
# the dev volume: Django builds and drops its own test database, and each
# Playwright test deletes the uniquely named jobs it created.
#
# The backend unit tests run first because they are fast and pinpoint a broken
# model or view directly, rather than as a browser timeout several layers away.
test: ## Run the backend unit tests, then the Playwright end-to-end suite
	$(COMPOSE) up -d --build --wait db backend frontend
	$(COMPOSE) run --rm backend python manage.py test
	$(COMPOSE) --profile test run --rm --build e2e

stop: ## Stop the running containers
	$(COMPOSE) stop

clean: ## Remove containers, networks and volumes for a clean slate
	$(COMPOSE) down --volumes --remove-orphans

logs: ## Follow the container logs
	$(COMPOSE) logs -f
