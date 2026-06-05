FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV JULIA_VERSION=1.10.4
ENV VIRTUAL_ENV=/opt/venv
ENV QUARTO_PYTHON=/opt/venv/bin/python
ENV PATH="/opt/venv/bin:/opt/julia/bin:${PATH}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    git \
    build-essential \
    pandoc \
    python3 \
    python3-dev \
    python3-pip \
    python3-venv \
    gdal-bin \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    proj-data \
    libspatialindex-dev \
    libsqlite3-dev \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    fonts-dejavu \
    lmodern \
    texlive-xetex \
    texlive-fonts-recommended \
    texlive-latex-recommended \
    texlive-latex-extra \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL -o /tmp/quarto.deb \
    https://github.com/quarto-dev/quarto-cli/releases/download/v1.4.550/quarto-1.4.550-linux-amd64.deb \
    && dpkg -i /tmp/quarto.deb \
    && rm /tmp/quarto.deb

RUN curl -fsSL -o /tmp/julia.tar.gz \
    https://julialang-s3.julialang.org/bin/linux/x64/1.10/julia-${JULIA_VERSION}-linux-x86_64.tar.gz \
    && mkdir -p /opt \
    && tar -xzf /tmp/julia.tar.gz -C /opt \
    && ln -s /opt/julia-${JULIA_VERSION} /opt/julia \
    && rm /tmp/julia.tar.gz

COPY requirements.txt /tmp/requirements.txt

RUN python3 -m venv ${VIRTUAL_ENV} \
    && pip install --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r /tmp/requirements.txt \
    && pip install --no-cache-dir \
      jupyterlab nbclient nbformat ipykernel

RUN julia -e 'using Pkg; Pkg.add(["CSV", "DataFrames", "Rasters", "ArchGDAL", "Plots"]); Pkg.precompile()'

WORKDIR /workspace

EXPOSE 8888

CMD ["jupyter", "lab", "--ip=0.0.0.0", "--port=8888", "--no-browser", "--allow-root"]
