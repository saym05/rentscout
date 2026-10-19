from alembic import context

from app.db import Base, make_engine

config = context.config
target_metadata = Base.metadata

conn = config.attributes.get("connection")
if conn is None:  # `alembic upgrade head` from the command line
    import os
    with make_engine(os.environ.get("DATABASE_URL", "sqlite:///./rentscout.db")).begin() as conn:
        context.configure(connection=conn, target_metadata=target_metadata)
        context.run_migrations()
else:
    context.configure(connection=conn, target_metadata=target_metadata)
    context.run_migrations()
