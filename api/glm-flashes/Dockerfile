FROM public.ecr.aws/lambda/python:3.12

# h5py/h5netcdf wheels include bundled HDF5, no system package needed
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY handler.py .

CMD ["handler.handler"]
